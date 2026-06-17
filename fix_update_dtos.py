def strip_dto(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # The fields I appended:
    to_remove = """
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  panCard?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  aadharCard?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  panCardUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  aadharCardUrl?: string;"""

    content = content.replace(to_remove, "")

    with open(filepath, "w") as f:
        f.write(content)

strip_dto("src/managers/dto/update-manager.dto.ts")
strip_dto("src/trainers/dto/update-trainer.dto.ts")
