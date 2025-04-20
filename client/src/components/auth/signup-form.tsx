import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
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

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must contain at least one lowercase letter"
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must contain at least one number"
  )
  .refine(
    (password) => /[^A-Za-z0-9]/.test(password),
    "Password must contain at least one special character"
  );

const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    username: z.string().min(1, "Email is required").email("Invalid email format"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupForm() {
  const { registerMutation } = useAuth();
  const [showError, setShowError] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  const onSubmit = (data: SignupFormValues) => {
    setShowError(false);
    registerMutation.mutate(
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

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 1;
    
    // Contains lowercase letters
    if (/[a-z]/.test(password)) strength += 1;
    
    // Contains uppercase letters
    if (/[A-Z]/.test(password)) strength += 1;
    
    // Contains numbers
    if (/[0-9]/.test(password)) strength += 1;
    
    // Contains special characters
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    return Math.min(strength, 4);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    form.setValue("password", password);
    setPasswordStrength(calculatePasswordStrength(password));
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-b-lg shadow-sm border border-t-0 border-gray-200">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">First name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Last Name */}
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Last name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
                <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <PasswordInput 
                      placeholder="Create a strong password" 
                      {...field} 
                      onChange={handlePasswordChange}
                    />

                    {/* Password Strength Indicator */}
                    <div>
                      <div className="flex space-x-1">
                        <div className={`h-1 w-1/4 rounded-full ${
                          passwordStrength >= 1 
                            ? passwordStrength === 1 
                              ? "bg-red-400" 
                              : passwordStrength === 2 
                                ? "bg-orange-400" 
                                : passwordStrength === 3 
                                  ? "bg-yellow-400" 
                                  : "bg-green-400"
                            : "bg-gray-200"
                        }`}></div>
                        <div className={`h-1 w-1/4 rounded-full ${
                          passwordStrength >= 2 
                            ? passwordStrength === 2 
                              ? "bg-orange-400" 
                              : passwordStrength === 3 
                                ? "bg-yellow-400" 
                                : "bg-green-400"
                            : "bg-gray-200"
                        }`}></div>
                        <div className={`h-1 w-1/4 rounded-full ${
                          passwordStrength >= 3 
                            ? passwordStrength === 3 
                              ? "bg-yellow-400" 
                              : "bg-green-400"
                            : "bg-gray-200"
                        }`}></div>
                        <div className={`h-1 w-1/4 rounded-full ${
                          passwordStrength >= 4 
                            ? "bg-green-400"
                            : "bg-gray-200"
                        }`}></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Use 8+ characters with a mix of letters, numbers & symbols
                      </p>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirm Password Field */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-700">Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      type="password"
                      placeholder="Confirm your password"
                      className="pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Terms Checkbox */}
          <FormField
            control={form.control}
            name="agreeToTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="terms"
                  />
                </FormControl>
                <div className="leading-none">
                  <FormLabel 
                    htmlFor="terms" 
                    className="text-sm font-medium text-gray-700 cursor-pointer"
                  >
                    I agree to the{" "}
                    <a href="#" className="text-blue-600 hover:text-blue-500">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-blue-600 hover:text-blue-500">
                      Privacy Policy
                    </a>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/* Error Message */}
          {showError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
              <div className="flex">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 self-center" />
                <span>There was an error creating your account. Please check the form and try again.</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <div className="flex items-center">
                <span>Creating account...</span>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </div>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
