import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Heart } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        navigate("/dashboard");
      } else {
        setError(result.error || "Bir hata oluştu");
      }
    } catch (err) {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">DentCare AI</h1>
                <p className="text-blue-100 font-medium">Akıllı Klinik Yönetimi</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight">
              Kliniğinizi Geleceğe Taşıyın
            </h2>
            <p className="text-xl text-blue-100 leading-relaxed">
              AI destekli klinik yönetim sistemi ile hasta takibi, randevu planlama, 
              finansal yönetim ve daha fazlası tek platformda.
            </p>
            
            <div className="grid grid-cols-1 gap-4 pt-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Güvenli & KVKK Uyumlu</div>
                  <div className="text-sm text-blue-100">Hasta verileriniz güvende</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Hızlı & Kolay Kullanım</div>
                  <div className="text-sm text-blue-100">Saniyeler içinde işlemlerinizi tamamlayın</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">Hasta Memnuniyeti</div>
                  <div className="text-sm text-blue-100">%40 artan hasta memnuniyeti</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="w-full max-w-md">
          <Card className="glass-effect border-0 shadow-2xl">
            <CardHeader className="space-y-6 pb-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="lg:hidden">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      DentCare AI
                    </h1>
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                  Hoş Geldiniz! 👋
                </CardTitle>
                <CardDescription className="text-gray-600 font-medium text-lg">
                  Klinik yönetim panelinize giriş yapın
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    E-posta Adresi
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="ornek@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="input-modern pl-4 pr-4 py-3 text-base"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-500" />
                    Şifre
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="input-modern pl-4 pr-12 py-3 text-base"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium animate-in">
                    {error}
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full btn-primary-gradient py-3 text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Giriş Yapılıyor...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Güvenli Giriş
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>
              
              {/* Demo Credentials */}
              <div className="border-t border-gray-200 pt-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-blue-800 mb-2">🎯 Demo Hesabı</div>
                    <div className="text-xs text-blue-600 space-y-1">
                      <div><strong>E-posta:</strong> admin@dentcare.com</div>
                      <div><strong>Şifre:</strong> admin123</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Footer */}
          <div className="text-center mt-8 text-sm text-gray-500">
            © 2024 DentCare AI • Güvenli ve KVKK Uyumlu
          </div>
        </div>
      </div>
    </div>
  );
}

