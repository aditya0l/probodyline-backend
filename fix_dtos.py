def fix_dto(filepath):
    with open(filepath, "r") as f:
        content = f.read()
    
    # We find the last "}" and replace it with the fields
    if "panCard" not in content:
        fields = """
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
  aadharCardUrl?: string;
}"""
        content = content.rsplit("}", 1)[0] + fields
        
        with open(filepath, "w") as f:
            f.write(content)

fix_dto("src/managers/dto/update-manager.dto.ts")
fix_dto("src/trainers/dto/create-trainer.dto.ts")
fix_dto("src/trainers/dto/update-trainer.dto.ts")
