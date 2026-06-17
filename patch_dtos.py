import os

def patch_dto(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    new_fields = """  @IsOptional()
  @IsString()
  panCard?: string;

  @IsOptional()
  @IsString()
  aadharCard?: string;

  @IsOptional()
  @IsString()
  panCardUrl?: string;

  @IsOptional()
  @IsString()
  aadharCardUrl?: string;
}"""

    content = content.replace("}", new_fields)

    with open(filepath, "w") as f:
        f.write(content)

patch_dto("src/managers/dto/create-manager.dto.ts")
patch_dto("src/managers/dto/update-manager.dto.ts")
patch_dto("src/trainers/dto/create-trainer.dto.ts")
patch_dto("src/trainers/dto/update-trainer.dto.ts")
