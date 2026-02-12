import { IsNotEmpty, IsString, IsObject, MaxLength } from 'class-validator';

export class ProposeActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  actionType!: string;

  @IsObject()
  @IsNotEmpty()
  payload!: any;
}

export class ExecuteActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  otpCode!: string;
}
