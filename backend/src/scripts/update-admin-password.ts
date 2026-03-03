import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';

dotenv.config();

async function updateAdminPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@valemilk.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    // Update password
    const newPassword = 'valimilksuporte2025';
    admin.hashed_password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    console.log('✅ Admin password updated successfully!');
    console.log('📝 New credentials:');
    console.log('   Email: admin@valemilk.com');
    console.log('   Password: valimilksuporte2025');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin password:', error);
    process.exit(1);
  }
}

updateAdminPassword();
