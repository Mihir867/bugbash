import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth({
  ...authOptions,
  session: {
	...authOptions.session,
	strategy: undefined, // or specify the correct SessionStrategy
  },
});

export { handler as GET, handler as POST };