/*
  Usage:
    node scripts/makeAdmin.js user@example.com

  This will set the user's role to 'admin'.
*/

const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../src/config/db');
const User = require('../src/models/userModel');

async function main() {
  const emailArg = process.argv[2];
  const email = String(emailArg || '').trim().toLowerCase();
  if (!email) {
    console.error('Please provide an email. Example: node scripts/makeAdmin.js user@example.com');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOneAndUpdate(
    { email },
    { role: 'admin' },
    { new: true }
  ).select('-password');

  if (!user) {
    console.error('User not found for email:', email);
    process.exit(1);
  }

  console.log('Updated user:', {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
