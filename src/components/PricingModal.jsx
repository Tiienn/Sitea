import { useState } from 'react'
import { PayPalButtons } from '@paypal/react-paypal-js'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * PricingModal - Premium pricing display with PayPal payment integration
 *
 * Pricing:
 * - Monthly: $9.99/month subscription
 * - Lifetime: $149 one-time payment
 */
export default function PricingModal({ onClose, onSuccess }) {
  const [selectedPlan, setSelectedPlan] = useState(null) // 'monthly' | 'lifetime'
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const MONTHLY_PRICE = '9.99'
  const LIFETIME_PRICE = '149.00'

  // Validate email before payment
  const validateEmail = () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }
    setError(null)
    return true
  }

  // Save subscription to Supabase
  const saveSubscription = async (paypalData, planType) => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, saving to localStorage only')
      localStorage.setItem('landVisualizerPaidUser', 'true')
      localStorage.setItem('landVisualizerEmail', email)
      localStorage.setItem('landVisualizerPlanType', planType)
      return true
    }

    try {
      const { error: dbError } = await supabase
        .from('subscriptions')
        .upsert({
          email: email.toLowerCase(),
          paypal_subscription_id: paypalData.subscriptionID || null,
          paypal_payer_id: paypalData.payerID,
          status: 'active',
          plan_type: planType,
          expires_at: planType === 'lifetime' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, { onConflict: 'email' })

      if (dbError) {
        console.error('Database error:', dbError)
        localStorage.setItem('landVisualizerPaidUser', 'true')
        localStorage.setItem('landVisualizerEmail', email)
      }

      localStorage.setItem('landVisualizerPaidUser', 'true')
      localStorage.setItem('landVisualizerEmail', email)
      localStorage.setItem('landVisualizerPlanType', planType)
      return true
    } catch (err) {
      console.error('Error saving subscription:', err)
      localStorage.setItem('landVisualizerPaidUser', 'true')
      return true
    }
  }

  // PayPal order creation for one-time payment
  const createLifetimeOrder = (data, actions) => {
    if (!validateEmail()) return Promise.reject('Invalid email')

    return actions.order.create({
      purchase_units: [{
        amount: {
          value: LIFETIME_PRICE,
          currency_code: 'USD'
        },
        description: 'Sitea Pro - Lifetime Access'
      }]
    })
  }

  // PayPal order approval for one-time payment
  const onLifetimeApprove = async (data, actions) => {
    setIsProcessing(true)
    try {
      const details = await actions.order.capture()
      await saveSubscription({ payerID: details.payer.payer_id }, 'lifetime')
      onSuccess?.('lifetime')
    } catch (err) {
      setError('Payment failed. Please try again.')
      console.error(err)
    }
    setIsProcessing(false)
  }

  // PayPal subscription creation for monthly
  const createMonthlySubscription = (data, actions) => {
    if (!validateEmail()) return Promise.reject('Invalid email')

    return actions.subscription.create({
      plan_id: import.meta.env.VITE_PAYPAL_MONTHLY_PLAN_ID || 'YOUR_PLAN_ID'
    })
  }

  // PayPal subscription approval
  const onMonthlyApprove = async (data) => {
    setIsProcessing(true)
    try {
      await saveSubscription({
        subscriptionID: data.subscriptionID,
        payerID: data.payerID
      }, 'monthly')
      onSuccess?.('monthly')
    } catch (err) {
      setError('Subscription failed. Please try again.')
      console.error(err)
    }
    setIsProcessing(false)
  }

  const features = {
    monthly: [
      { icon: 'sparkles', text: 'AI-powered floor plan analysis' },
      { icon: 'layers', text: 'Unlimited projects & exports' },
      { icon: 'refresh', text: 'Cancel anytime' }
    ],
    lifetime: [
      { icon: 'infinity', text: 'Everything in Monthly Pro' },
      { icon: 'crown', text: 'Pay once, own forever' },
      { icon: 'rocket', text: 'All future updates free' }
    ]
  }

  const FeatureIcon = ({ type }) => {
    const icons = {
      sparkles: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      layers: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      refresh: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      infinity: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.781 0-4.781 8 0 8 5.606 0 7.644-8 12.74-8z" />
        </svg>
      ),
      crown: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l2-6 4 3 3-4 3 4 4-3 2 6v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
        </svg>
      ),
      rocket: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      )
    }
    return icons[type] || null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Animated gradient backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Floating ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[128px] pointer-events-none" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl"
        style={{
          animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-14 right-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Glass card container */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-800/90 to-slate-900/95 border border-white/10 shadow-2xl shadow-black/50">
          {/* Top highlight line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

          {/* Inner glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative px-8 pt-10 pb-6 text-center">
            {/* Pro badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Upgrade to Pro
              </span>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
              Design Without Limits
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Transform any floor plan into stunning 3D visualizations with AI-powered tools.
            </p>
          </div>

          {/* Email input */}
          <div className="px-8 pb-12">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email for license delivery"
              className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white text-center placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all text-sm"
            />
            {error && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Pricing cards */}
          <div className="px-8 pb-12 pt-4 grid md:grid-cols-2 gap-5">
            {/* Monthly Plan */}
            <div
              className={`relative group cursor-pointer transition-all duration-300 ${
                selectedPlan === 'monthly' ? 'scale-[1.02]' : 'hover:scale-[1.01]'
              }`}
              onClick={() => setSelectedPlan('monthly')}
            >
              {/* Animated border gradient */}
              <div className={`absolute -inset-px rounded-2xl transition-opacity duration-300 ${
                selectedPlan === 'monthly' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
              }`} style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4, #10b981)',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 3s ease infinite'
              }} />

              {/* Card content */}
              <div className={`relative p-6 rounded-2xl transition-all duration-300 ${
                selectedPlan === 'monthly'
                  ? 'bg-slate-800/90'
                  : 'bg-slate-800/40 group-hover:bg-slate-800/60'
              }`}>
                {/* Selection indicator */}
                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedPlan === 'monthly'
                    ? 'border-emerald-400 bg-emerald-400'
                    : 'border-slate-600'
                }`}>
                  {selectedPlan === 'monthly' && (
                    <svg className="w-3 h-3 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${MONTHLY_PRICE}</span>
                    <span className="text-slate-400 text-sm">/month</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mt-1">Monthly Pro</h3>
                </div>

                <ul className="space-y-3 mb-5">
                  {features.monthly.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <FeatureIcon type={feature.icon} />
                      </div>
                      {feature.text}
                    </li>
                  ))}
                </ul>

                {/* PayPal button for monthly */}
                {selectedPlan === 'monthly' && email && (
                  <div className="mt-4 animate-fadeIn">
                    <PayPalButtons
                      style={{
                        layout: 'vertical',
                        color: 'gold',
                        shape: 'pill',
                        label: 'subscribe',
                        height: 45
                      }}
                      createSubscription={createMonthlySubscription}
                      onApprove={onMonthlyApprove}
                      onError={(err) => {
                        console.error('PayPal error:', err)
                        setError('Payment failed. Please try again.')
                      }}
                      disabled={isProcessing}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Lifetime Plan */}
            <div
              className={`relative group cursor-pointer transition-all duration-300 ${
                selectedPlan === 'lifetime' ? 'scale-[1.02]' : 'hover:scale-[1.01]'
              }`}
              onClick={() => setSelectedPlan('lifetime')}
            >
              {/* Best value badge */}
              <div className="absolute -top-2 right-4 z-10">
                <div className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 text-[10px] font-bold tracking-wide shadow-lg shadow-amber-500/25">
                  BEST VALUE
                </div>
              </div>

              {/* Animated border gradient */}
              <div className={`absolute -inset-px rounded-2xl transition-opacity duration-300 ${
                selectedPlan === 'lifetime' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
              }`} style={{
                background: 'linear-gradient(135deg, #f59e0b, #f97316, #f59e0b)',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 3s ease infinite'
              }} />

              {/* Card content */}
              <div className={`relative p-6 rounded-2xl transition-all duration-300 ${
                selectedPlan === 'lifetime'
                  ? 'bg-slate-800/90'
                  : 'bg-slate-800/40 group-hover:bg-slate-800/60'
              }`}>
                {/* Selection indicator */}
                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedPlan === 'lifetime'
                    ? 'border-amber-400 bg-amber-400'
                    : 'border-slate-600'
                }`}>
                  {selectedPlan === 'lifetime' && (
                    <svg className="w-3 h-3 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${LIFETIME_PRICE}</span>
                    <span className="text-slate-400 text-sm">one-time</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mt-1">Lifetime Access</h3>
                </div>

                <ul className="space-y-3 mb-5">
                  {features.lifetime.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                        <FeatureIcon type={feature.icon} />
                      </div>
                      {feature.text}
                    </li>
                  ))}
                </ul>

                {/* PayPal button for lifetime */}
                {selectedPlan === 'lifetime' && email && (
                  <div className="mt-4 animate-fadeIn">
                    <PayPalButtons
                      style={{
                        layout: 'vertical',
                        color: 'gold',
                        shape: 'pill',
                        label: 'pay',
                        height: 45
                      }}
                      createOrder={createLifetimeOrder}
                      onApprove={onLifetimeApprove}
                      onError={(err) => {
                        console.error('PayPal error:', err)
                        setError('Payment failed. Please try again.')
                      }}
                      disabled={isProcessing}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="px-8 pb-8 pt-4">
            <div className="flex items-center justify-center gap-6 py-6 border-t border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Secure Payment
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                30-Day Guarantee
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.048l-1.972 7.744a.639.639 0 0 1-.623.496H7.076z" />
                </svg>
                PayPal Protected
              </div>
            </div>
          </div>
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-3xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              <p className="text-white font-medium">Processing payment...</p>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
