import { Table, Model, ForeignKey, Column, DataType, BelongsTo } from "sequelize-typescript";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";

@Table({ tableName: 'comments', timestamps: true })
export class Comment extends Model<Comment> {
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    })
    declare id: number;

    @ForeignKey(() => User)
    @Column({
        type: DataType.INTEGER,
        allowNull: true,
        field: 'UserId',
    })
    declare UserId: number;

    @ForeignKey(() => Post)
    @Column({
        type: DataType.BIGINT,
        allowNull: true,
        field: 'PostId',
    })
    declare PostId: number;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
    declare content: string;

    @BelongsTo(() => Post)
    post: Post;

    @BelongsTo(() => User)
    user: User;
}