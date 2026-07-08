import { Injectable } from '@nestjs/common';
import {
  TextractClient,
  AnalyzeDocumentCommand,
  FeatureType,
  DetectDocumentTextCommand
} from '@aws-sdk/client-textract';

@Injectable()
export class TextractService {
  private client: TextractClient;

  constructor() {
    this.client = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
  }

  async analyzeDocument(s3Bucket: string, s3Key: string, fileBuffer?: Buffer, mimetype?: string) {
    // If it's an image, use Bytes since the S3 version is WebP (unsupported by Textract)
    // Only use S3Object if it's a PDF or if no buffer is provided
    let documentParam: any;
    if (fileBuffer && mimetype && mimetype.startsWith('image/')) {
        documentParam = {
            Bytes: new Uint8Array(fileBuffer)
        };
    } else {
        documentParam = {
            S3Object: {
              Bucket: s3Bucket,
              Name: s3Key
            }
        };
    }

    const command = new AnalyzeDocumentCommand({
      Document: documentParam,
      FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES]
    });

    const response = await this.client.send(command);
    return response.Blocks ?? [];
  }

  async detectText(s3Bucket: string, s3Key: string, fileBuffer?: Buffer, mimetype?: string) {
    let documentParam: any;
    if (fileBuffer && mimetype && mimetype.startsWith('image/')) {
        documentParam = {
            Bytes: new Uint8Array(fileBuffer)
        };
    } else {
        documentParam = {
            S3Object: {
              Bucket: s3Bucket,
              Name: s3Key
            }
        };
    }

    const command = new DetectDocumentTextCommand({
      Document: documentParam
    });

    const response = await this.client.send(command);
    return response.Blocks ?? [];
  }

  // Extract all raw text lines from blocks
  extractRawText(blocks: any[]): string {
    return blocks
      .filter(b => b.BlockType === 'LINE')
      .map(b => b.Text ?? '')
      .join('\n');
  }

  // Extract key-value pairs from FORMS analysis
  extractKeyValuePairs(blocks: any[]): Record<string, string> {
    const keyMap = new Map<string, any>();
    const valueMap = new Map<string, any>();
    const kvPairs: Record<string, string> = {};

    blocks.forEach(block => {
      if (block.BlockType === 'KEY_VALUE_SET') {
        if (block.EntityTypes?.includes('KEY')) {
          keyMap.set(block.Id, block);
        } else {
          valueMap.set(block.Id, block);
        }
      }
    });

    keyMap.forEach((keyBlock, keyId) => {
      const keyText = this.getTextFromBlock(keyBlock, blocks);
      const valueBlockId = keyBlock.Relationships
        ?.find((r: any) => r.Type === 'VALUE')
        ?.Ids?.[0];

      if (valueBlockId) {
        const valueBlock = valueMap.get(valueBlockId);
        const valueText = this.getTextFromBlock(valueBlock, blocks);
        if (keyText && valueText) {
          kvPairs[keyText.toLowerCase().trim()] = valueText.trim();
        }
      }
    });

    return kvPairs;
  }

  private getTextFromBlock(block: any, allBlocks: any[]): string {
    if (!block?.Relationships) return block?.Text ?? '';
    const wordIds = block.Relationships
      .filter((r: any) => r.Type === 'CHILD')
      .flatMap((r: any) => r.Ids);
    return allBlocks
      .filter(b => wordIds.includes(b.Id) && b.BlockType === 'WORD')
      .map(b => b.Text)
      .join(' ');
  }
}
