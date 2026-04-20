import { useState, type FormEvent, type ChangeEvent } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const inputClassName =
    "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-10 font-sans antialiased">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 shadow-xl shadow-black/[0.04]">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your email and password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              placeholder="you@example.com"
              required
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              required
              className={inputClassName}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
