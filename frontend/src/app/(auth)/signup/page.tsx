import Logo from "@/components/ui/Logo";
import SignupForm from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-background h-screen relative py-4">
      <div className="fixed top-6 left-6 z-[100]">
        <Logo />
      </div>
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        <SignupForm isModal={false} />
      </div>
    </div>
  );
}
