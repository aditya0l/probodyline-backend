import re

with open("prisma/schema.prisma", "r") as f:
    content = f.read()

manager_add = """  notes          String?  @db.Text
  panCard        String?
  aadharCard     String?
  panCardUrl     String?
  aadharCardUrl  String?
  createdAt      DateTime @default(now())"""

content = content.replace("  notes          String?  @db.Text\n  createdAt      DateTime @default(now())", manager_add)

with open("prisma/schema.prisma", "w") as f:
    f.write(content)
