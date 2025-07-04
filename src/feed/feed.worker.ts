import { Worker } from "bullmq";
import Redis from "ioredis";
import { Sequelize } from "sequelize-typescript";
import { Follow } from "../follows/follow.model";
import * as dotenv from "dotenv";
import { User } from "../users/user.model";
import { Post } from "../posts/post.model";

dotenv.config();

// Step 1: Redis setup
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Step 2: Sequelize setup
const sequelize = new Sequelize({
  dialect: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "instagram",
  models: [Follow, User, Post],
  logging: false,
});

const init = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Sequelize connected in worker");

    new Worker(
      "feed-fanout",
      async (job) => {
        const { userId, postId } = job.data;

        console.log(`📨 Received job for postId ${postId} by user ${userId}`);

        const user = await User.findByPk(userId);

        if (!user) {
          console.log(`❌ User ${userId} not found`);
          return;
        }

        // If user is celebrity, skip fan-out
        if (user.isCelebrity) {
          console.log(`User ${userId} is a celebrity. Skipping fanout.`);
          return;
        }

        // Fanout for normal user
        const followers = await Follow.findAll({
          where: { followedId: userId },
          attributes: ["followerId"],
        });

        if (!followers || followers.length === 0) {
          console.log(`⚠️ No followers found for user ${userId}. Skipping fanout.`);
          return;
        }

        console.log(`✅ Found ${followers.length} followers for user ${userId}`);

        const pipelines = redis.pipeline();

        followers.forEach((f) => {
          const fid = f.getDataValue("followerId");
          const feedKey = `feed:${fid}`;
          pipelines.zadd(feedKey, postId, String(postId));
          pipelines.zremrangebyrank(feedKey, 0, -101);
        //   pipelines.lpush(`feed:${fid}`, postId);
        //   pipelines.ltrim(`feed:${fid}`, 0, 99);
        });

        await pipelines.exec();
        console.log(`📬 Pushed postId ${postId} to ${followers.length} feeds`);
      },
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      }
    );
  } catch (err) {
    console.error("❌ Sequelize connection failed in worker:", err);
    process.exit(1);
  }
};

init();
