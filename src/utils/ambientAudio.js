// Procedural ambient audio for walk mode — no audio assets, everything is
// synthesized with Web Audio: a wind noise bed, occasional bird chirps, and
// grass footsteps. Created lazily; resumes on first user gesture per
// browser autoplay policy.

let ctx = null
let master = null
let ambientNodes = null
let birdTimer = null
let ambientOn = false
let indoor = false
let lastDoorSoundAt = 0
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('siteaSoundMuted') === 'true'

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
    // Autoplay policy: also resume on the next gesture if still suspended
    const resume = () => {
      ctx.resume()
      document.removeEventListener('pointerdown', resume)
      document.removeEventListener('keydown', resume)
    }
    document.addEventListener('pointerdown', resume, { once: true })
    document.addEventListener('keydown', resume, { once: true })
  }
  return ctx
}

export function isAudioMuted() {
  return muted
}

export function setAudioMuted(m) {
  muted = m
  try { localStorage.setItem('siteaSoundMuted', String(m)) } catch { /* private mode */ }
  if (master) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.linearRampToValueAtTime(m ? 0 : 1, ctx.currentTime + 0.15)
  }
}

// Soft wind bed: looped noise → lowpass → slow LFO breathing
function beginWind() {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(1, sr * 4, sr)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  lp.Q.value = 0.4
  const gain = ctx.createGain()
  gain.gain.value = 0.045
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.08
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.02
  lfo.connect(lfoDepth)
  lfoDepth.connect(gain.gain)
  src.connect(lp)
  lp.connect(gain)
  gain.connect(master)
  src.start()
  lfo.start()
  ambientNodes = { src, lfo, lp, gain, lfoDepth }
  if (indoor) applyIndoorWind(true, 0)
}

// Ease the wind bed between outdoor and indoor (muffled) settings
function applyIndoorWind(isIndoor, rampSec = 0.8) {
  if (!ambientNodes || !ctx) return
  const t = ctx.currentTime
  const { lp, gain, lfoDepth } = ambientNodes
  lp.frequency.cancelScheduledValues(t)
  lp.frequency.linearRampToValueAtTime(isIndoor ? 160 : 380, t + rampSec)
  gain.gain.cancelScheduledValues(t)
  gain.gain.linearRampToValueAtTime(isIndoor ? 0.016 : 0.045, t + rampSec)
  lfoDepth.gain.cancelScheduledValues(t)
  lfoDepth.gain.linearRampToValueAtTime(isIndoor ? 0.006 : 0.02, t + rampSec)
}

// Indoors: muffle the wind bed and quiet the birds; outdoors restores them
export function setIndoor(isIndoor) {
  if (indoor === isIndoor) return
  indoor = isIndoor
  applyIndoorWind(isIndoor)
}

// One bird call: a few quick FM-ish sine sweeps, randomly panned
function chirp() {
  if (!ctx || ctx.state !== 'running' || muted) return
  const t0 = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.value = 0
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const base = 2400 + Math.random() * 1400
  const notes = 2 + Math.floor(Math.random() * 3)
  let t = t0
  for (let i = 0; i < notes; i++) {
    const dur = 0.06 + Math.random() * 0.08
    osc.frequency.setValueAtTime(base + Math.random() * 500, t)
    osc.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.2), t + dur)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(indoor ? 0.01 : 0.035, t + 0.015)
    gain.gain.linearRampToValueAtTime(0, t + dur)
    t += dur + 0.04 + Math.random() * 0.05
  }
  osc.connect(gain)
  if (ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 1.6 - 0.8
    gain.connect(pan)
    pan.connect(master)
  } else {
    gain.connect(master)
  }
  osc.start(t0)
  osc.stop(t + 0.05)
}

function scheduleBird() {
  birdTimer = setTimeout(() => {
    chirp()
    scheduleBird()
  }, 2500 + Math.random() * 7000)
}

export function startAmbient() {
  if (ambientOn || !ensureCtx()) return
  ambientOn = true
  beginWind()
  scheduleBird()
}

export function stopAmbient() {
  if (!ambientOn) return
  ambientOn = false
  clearTimeout(birdTimer)
  try {
    ambientNodes.src.stop()
    ambientNodes.lfo.stop()
  } catch { /* already stopped */ }
  ambientNodes = null
}

// Grass footstep: a soft "swish" — noise with a gentle attack (no click)
// shaped through a high bandpass, like dry grass brushing underfoot
export function playFootstep(running = false) {
  if (!ensureCtx() || muted || ctx.state !== 'running') return
  const dur = running ? 0.11 : 0.14
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length
    // ~25% eased attack, then smooth decay — removes the percussive knock
    const attack = Math.min(1, p / 0.25)
    const env = attack * attack * Math.pow(1 - p, 1.6)
    d[i] = (Math.random() * 2 - 1) * env
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = 0.9 + Math.random() * 0.25
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1400 + Math.random() * 900
  bp.Q.value = 0.45
  const gain = ctx.createGain()
  gain.gain.value = running ? 0.3 : 0.2
  src.connect(bp)
  bp.connect(gain)
  gain.connect(master)
  src.start()
}

// Soft door swing: a low filtered noise "creak" with an eased attack plus a
// quiet wooden thump. Two doors close together never stack (≥150 ms gap).
export function playDoorSound() {
  if (!ensureCtx() || muted || ctx.state !== 'running') return
  const now = performance.now()
  if (now - lastDoorSoundAt < 150) return
  lastDoorSoundAt = now

  const t0 = ctx.currentTime
  const dur = 0.32
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length
    const attack = Math.min(1, p / 0.35)
    const env = attack * Math.pow(1 - p, 1.4)
    d[i] = (Math.random() * 2 - 1) * env
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = 0.85 + Math.random() * 0.2
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(260, t0)
  bp.frequency.linearRampToValueAtTime(420, t0 + dur) // rising pitch = hinge sweep
  bp.Q.value = 2.5
  const creakGain = ctx.createGain()
  creakGain.gain.value = 0.12
  src.connect(bp)
  bp.connect(creakGain)
  creakGain.connect(master)
  src.start(t0)

  // Low wooden thump underneath
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(130, t0)
  osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.12)
  const thumpGain = ctx.createGain()
  thumpGain.gain.setValueAtTime(0, t0)
  thumpGain.gain.linearRampToValueAtTime(0.06, t0 + 0.02)
  thumpGain.gain.linearRampToValueAtTime(0, t0 + 0.14)
  osc.connect(thumpGain)
  thumpGain.connect(master)
  osc.start(t0)
  osc.stop(t0 + 0.16)
}
