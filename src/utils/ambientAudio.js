// Procedural ambient audio for walk mode — no audio assets, everything is
// synthesized with Web Audio: a wind noise bed, occasional bird chirps, and
// grass footsteps. Created lazily; resumes on first user gesture per
// browser autoplay policy.

let ctx = null
let master = null
let ambientNodes = null
let birdTimer = null
let ambientOn = false
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
  ambientNodes = { src, lfo }
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
    gain.gain.linearRampToValueAtTime(0.035, t + 0.015)
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

// Grass footstep: short shaped noise burst through a bandpass
export function playFootstep(running = false) {
  if (!ensureCtx() || muted || ctx.state !== 'running') return
  const dur = 0.09
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    const env = 1 - i / d.length
    d[i] = (Math.random() * 2 - 1) * env * env
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 320 + Math.random() * 280
  bp.Q.value = 0.8
  const gain = ctx.createGain()
  gain.gain.value = running ? 0.5 : 0.33
  src.connect(bp)
  bp.connect(gain)
  gain.connect(master)
  src.start()
}
