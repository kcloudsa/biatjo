// import { Router, Request, Response } from 'express';
// import bcrypt from 'bcryptjs';
// import { getUserByEmail } from '../../../services/userServices';
// import Iuser from '../../../interfaces/Iuser';
// import UserModel from '../../../models/userModel';

// export const debugRoutes = Router();

// debugRoutes.get('/debug/auth-status', (req: Request, res: Response) => {
//   res.json({
//     isAuthenticated: (req as any).isAuthenticated
//       ? (req as any).isAuthenticated()
//       : false,
//     hasUser: !!(req as any).user,
//     user: (req as any).user
//       ? {
//           id: (req as any).user.id,
//           email: (req as any).user.email,
//           name: (req as any).user.name,
//           role: (req as any).user.role,
//         }
//       : null,
//     sessionID: (req as any).sessionID,
//     hasSession: !!(req as any).session,
//     cookies: (req as any).cookies,
//   });
// });

// debugRoutes.post('/migrate-passwords', async (req: Request, res: Response) => {
//   try {
//     const { adminSecret } = req.body;
//     if (
//       adminSecret !== process.env.ADMIN_SECRET &&
//       adminSecret !== 'dev-migrate-123'
//     ) {
//       return res.status(403).json({ success: false, message: 'Unauthorized' });
//     }

//     const users = await UserModel.find({});
//     let migrated = 0;
//     let skipped = 0;
//     for (const user of users) {
//       if (user.password?.hashed) {
//         const storedPassword = user.password.hashed as string;
//         if (storedPassword.startsWith('$2')) {
//           skipped++;
//           continue;
//         }
//         try {
//           const value = storedPassword;
//           const updateValue = value.startsWith('$2')
//             ? value
//             : await bcrypt.hash(value, 12);
//           await UserModel.updateOne(
//             { _id: (user as any)._id },
//             { 'password.hashed': updateValue },
//           );
//           migrated++;
//         } catch (error) {
//           console.error(
//             `Failed to migrate password for user: ${
//               (user as any).contactInfo?.email?.email
//             }`,
//             error,
//           );
//         }
//       }
//     }
//     return res.json({
//       success: true,
//       message: 'Password migration completed',
//       migrated,
//       skipped,
//       total: users.length,
//     });
//   } catch (error: any) {
//     console.error('Migration error:', error);
//     return res
//       .status(500)
//       .json({
//         success: false,
//         message: 'Migration failed',
//         error: error.message,
//       });
//   }
// });

// debugRoutes.post(
//   '/debug/test-password/:email',
//   async (req: Request, res: Response) => {
//     try {
//       const { email } = req.params;
//       const { testPassword } = req.body;
//       if (!testPassword)
//         return res.status(400).json({ error: 'testPassword is required' });
//       const user = (await getUserByEmail(email)) as Iuser | null;
//       if (!user || !user.password?.hashed)
//         return res.json({ found: false, error: 'User or password not found' });
//       const storedHash = user.password.hashed as string;
//       const testVariations = [
//         testPassword,
//         testPassword.toLowerCase(),
//         testPassword.toUpperCase(),
//         testPassword.trim(),
//       ];
//       const results: any[] = [];
//       for (const variation of testVariations) {
//         try {
//           const isMatch = await bcrypt.compare(variation, storedHash);
//           results.push({
//             tested: variation,
//             match: isMatch,
//             description:
//               variation === testPassword
//                 ? 'original'
//                 : variation === testPassword.toLowerCase()
//                 ? 'lowercase'
//                 : variation === testPassword.toUpperCase()
//                 ? 'uppercase'
//                 : 'trimmed',
//           });
//         } catch (error) {
//           results.push({
//             tested: variation,
//             match: false,
//             error: error instanceof Error ? error.message : 'Unknown error',
//           });
//         }
//       }
//       const newHash = await bcrypt.hash(testPassword, 12);
//       const newHashTest = await bcrypt.compare(testPassword, newHash);
//       return res.json({
//         found: true,
//         userID: user.userID,
//         email: (user as any).contactInfo?.email?.email,
//         storedHashPrefix: storedHash.substring(0, 20),
//         testResults: results,
//         bcryptWorking: {
//           newHashGenerated: newHash.substring(0, 20),
//           newHashTest: newHashTest,
//         },
//       });
//     } catch (error) {
//       console.error('Debug password test error:', error);
//       return res.status(500).json({ error: 'Debug test failed' });
//     }
//   },
// );

// debugRoutes.get(
//   '/debug/check-user/:email',
//   async (req: Request, res: Response) => {
//     try {
//       const { email } = req.params;
//       const user = (await getUserByEmail(email)) as Iuser | null;
//       if (!user) return res.json({ found: false });
//       return res.json({
//         found: true,
//         userID: user.userID,
//         email: (user as any).contactInfo?.email?.email,
//         hasPassword: !!user.password,
//         hasHashedPassword: !!user.password?.hashed,
//         passwordType: typeof user.password?.hashed,
//         passwordLength: user.password?.hashed?.length,
//         passwordStartsWith: {
//           $2a$: user.password?.hashed?.startsWith('$2a$'),
//           $2b$: user.password?.hashed?.startsWith('$2b$'),
//           $2y$: user.password?.hashed?.startsWith('$2y$'),
//         },
//         passwordPrefix: user.password?.hashed?.substring(0, 20),
//       });
//     } catch (error) {
//       console.error('Debug check error:', error);
//       return res.status(500).json({ error: 'Debug check failed' });
//     }
//   },
// );

// debugRoutes.post(
//   '/debug/reset-password/:email',
//   async (req: Request, res: Response) => {
//     try {
//       const { email } = req.params;
//       const { newPassword, adminSecret } = req.body;
//       if (adminSecret !== 'dev-reset-password-123')
//         return res.status(403).json({ error: 'Unauthorized' });
//       if (!newPassword)
//         return res.status(400).json({ error: 'newPassword is required' });
//       const user = (await getUserByEmail(email)) as Iuser | null;
//       if (!user) return res.json({ found: false, error: 'User not found' });
//       const hashedPassword = newPassword.startsWith('$2')
//         ? newPassword
//         : await bcrypt.hash(newPassword, 12);
//       await UserModel.updateOne(
//         {
//           $or: [
//             { 'contactInfo.email.value': email },
//             { 'contactInfo.email.email': email },
//           ],
//         },
//         { 'password.hashed': hashedPassword },
//       );
//       const testResult = await bcrypt.compare(newPassword, hashedPassword);
//       return res.json({
//         success: true,
//         message: 'Password reset successfully',
//         userID: user.userID,
//         email: (user as any).contactInfo?.email?.email,
//         newPasswordTest: testResult,
//       });
//     } catch (error) {
//       console.error('Debug password reset error:', error);
//       return res.status(500).json({ error: 'Debug reset failed' });
//     }
//   },
// );
