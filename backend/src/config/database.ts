import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'valemilk_cis';

    if (!mongoURI) {
      throw new Error('MONGODB_URI not defined in environment variables');
    }

    await mongoose.connect(mongoURI, {
      dbName: dbName,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    console.log(`✅ MongoDB Connected: ${dbName}`);

    // Create indexes
    await createIndexes();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('⚠️  Server will continue without MongoDB. Using mock data.');
    // Não mata o processo, apenas avisa
  }
};

const createIndexes = async () => {
  try {
    const User = mongoose.connection.collection('users');
    await User.createIndex({ email: 1 }, { unique: true });
    await User.createIndex({ perfil: 1 });

    const Pedido = mongoose.connection.collection('pedidos');
    await Pedido.createIndex({ numero: 1 }, { unique: true });
    await Pedido.createIndex({ status_atual: 1 });
    await Pedido.createIndex({ data_criacao: -1 });
    await Pedido.createIndex({ comprador_id: 1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('⚠️  Index creation warning:', error);
  }
};
