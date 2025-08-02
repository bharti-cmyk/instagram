import { Follow } from '../follows/follow.model';

export const seedFollows = async () => {
  const follows: any = [];

  for (let followerId = 6; followerId <= 20; followerId++) {
    for (let followedId = 1; followedId <= 5; followedId++) {
      follows.push({ followerId, followedId }); // everyone follows all celebs
    }
  }
  await Follow.bulkCreate(follows);
  console.log(' Seeded Follows');
};

