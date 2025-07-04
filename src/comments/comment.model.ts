import { Table, Model, ForeignKey, Column, DataType, BelongsTo } from "sequelize-typescript";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";

@Table({ tableName: 'comments', timestamps: true})
export class Comment extends Model<Comment> {
    @ForeignKey(() => User)
    @Column
    declare UserId: number;

    @ForeignKey(() => Post)
    @Column
    declare PostId: number;

    @Column(DataType.TEXT)
    content: string

    @BelongsTo(() => Post)
    post: Post;

    @BelongsTo(() => User)
    user: User

}