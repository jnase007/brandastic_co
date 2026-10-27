import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Loader2, Users, Building2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { useToast } from '../hooks/useToast'

// Brandastic Logo (PNG with transparency for dark mode)
const LOGO = 'https://auth.brandastic.co/storage/v1/object/public/images/mark.png'

// Team photos - rotating backgrounds
const TEAM_PHOTOS = [
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/C_DSC03021_Edited%20(4).jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC02954%20(1).jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC03001.jpg',
  'https://auth.brandastic.co/storage/v1/object/public/images/DSC03052.jpg',
  'https://auth.brandastic.co/storage/v1/object/public/images/DSC02926%20(1).jpg',
]

// Fisher-Yates shuffle
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function Login() {
  const navigate = useNavigate()
  const { signInWithGoogle, user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  const shuffledPhotos = useMemo(() => shuffleArray(TEAM_PHOTOS), [])

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/profitability', { replace: true })
  }, [user, navigate])

  // Rotate background images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % shuffledPhotos.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [shuffledPhotos.length])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const { error } = await signInWithGoogle()
      if (error) throw error
    } catch (error) {
      toast({ 
        title: 'Sign in failed', 
        description: error.message || 'Please try again.',
        variant: 'destructive' 
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <AnimatePresence mode="sync">
          <motion.img
            key={currentImageIndex}
            src={shuffledPhotos[currentImageIndex]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30" />
        
        {/* Overlay Content */}
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-4xl font-display font-bold mb-3">
              Where creativity meets results
            </h2>
            <p className="text-white/70 text-lg max-w-md">
              Manage projects, track time, and collaborate with your team — all in one place.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Logo & Title */}
          <div className="text-center mb-10">
            <motion.img
              src={LOGO}
              alt="Brandastic"
              className="w-20 h-20 mx-auto mb-6"
              whileHover={{ scale: 1.05, rotate: 3 }}
            />
            <h1 className="text-3xl font-display font-bold">Welcome back</h1>
            <p className="text-muted-foreground mt-2">Sign in with your Brandastic account</p>
          </div>

          {/* Google Sign In - Primary CTA */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              type="button"
              className="w-full h-14 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-lg group"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                  <ArrowRight className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </>
              )}
            </Button>
          </motion.div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Use your @brandastic.com Google account
          </p>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-10">
            Need access? Contact your administrator
          </p>
        </motion.div>
      </div>
    </div>
  )
}
