import { IsNumber, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { UserBaseDetail } from "../../users/dto/userBaseDetail.dto";

export class FollowedList{

    @IsNumber()
    count: number

    @ValidateNested({ each : true})
    @Type(() => UserBaseDetail)
    following: UserBaseDetail[]
}