import { IsNumber, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { UserBaseDetail } from "../../users/dto/userBaseDetail.dto";

export class FollowerList{

    @IsNumber()
    count: number

    @ValidateNested({ each : true})
    @Type(() => UserBaseDetail)
    followers: UserBaseDetail[]
}