import { User } from '../users/user.model';
import * as bcrypt from 'bcrypt';

export const seedUsers = async () => {
  const users: any = [];

  for (let i = 1; i <= 20; i++) {
    const hashedPassword = await bcrypt.hash('password', 10);
    users.push({
      username: `user${i}`,
      email: `user${i}@test.com`,
      password: hashedPassword,
      bio: `I am user${i}`,
      avatarUrl: `https://avatar.com/u${i}`,
      isCelebrity: i <= 5, // first 5 are celebs
    });
  }
  await User.bulkCreate(users);
  console.log('Seeded Users');
};

