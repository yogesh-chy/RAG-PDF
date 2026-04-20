import Logo from "@/components/ui/Logo";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-background h-screen relative py-4">
      <div className="fixed top-6 left-6 z-[100]">
        <Logo />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        <LoginForm isModal={false} />
      </div>
    </div>
  );
}
