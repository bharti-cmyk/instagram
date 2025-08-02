import { Post } from '../posts/post.model';

export const seedPosts = async () => {
  const posts: any = [];

  for (let userId = 1; userId <= 20; userId++) {
    for (let j = 1; j <= 5; j++) {
      posts.push({
        userId,
        caption: `Post ${j} by user ${userId}`,
        imageUrl: `https://img.com/${userId}-${j}`,
      });
    }
  }
  await Post.bulkCreate(posts);
  console.log(' Seeded Posts');
};

