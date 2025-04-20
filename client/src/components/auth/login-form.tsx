import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordInput from "./password-input";

const loginSchema = z.object({
  username: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const { loginMutation } = useAuth();
  const [showError, setShowError] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setShowError(false);
    loginMutation.mutate(
      {
        username: data.username,
        password: data.password,
      },
      {
        onError: () => {
          setShowError(true);
        },
      }
    );
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-b-lg shadow-sm border border-t-0 border-gray-200">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Email Field */}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      placeholder="you@example.com"
                      className="pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                  <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Forgot password?
                  </a>
                </div>
                <FormControl>
                  <PasswordInput placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remember Me Checkbox */}
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox 
                    checked={field.value} 
                    onCheckedChange={field.onChange}
                    id="remember-me"
                  />
                </FormControl>
                <FormLabel 
                  htmlFor="remember-me" 
                  className="text-sm font-normal text-gray-700 cursor-pointer"
                >
                  Remember me for 30 days
                </FormLabel>
              </FormItem>
            )}
          />

          {/* Error Message */}
          {showError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
              <div className="flex">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 self-center" />
                <span>Invalid email or password. Please check your credentials and try again.</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <div className="flex items-center">
                <span>Logging in...</span>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </div>
            ) : (
              "Log in to your account"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
