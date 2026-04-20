## Packages
framer-motion | Smooth animations, page transitions, and micro-interactions
date-fns | Robust date formatting for events, announcements, and feed posts
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility to merge tailwind classes without style conflicts
lucide-react | Beautiful, consistent icons

## Notes
- Using framer-motion for premium feel (staggered entries, smooth modals).
- Using a custom AuthContext to manage global user state based on the /api/auth/me endpoint.
- Assuming the backend relies on standard cookie-based authentication or the fetch calls will pass the token manually if needed (falling back to credentials: 'include' as configured in queryClient).
- Tailwind config must have font-display and font-sans configured to use Outfit and Inter.
