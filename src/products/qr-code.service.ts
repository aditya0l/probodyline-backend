import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class QRCodeService {
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Generate QR code for a product containing the model number
   * @param productId - Unique product ID
   * @param modelNumber - Model number to encode in QR code
   * @returns Relative path to the generated QR code image
   */
  async generateProductQRCode(
    productId: string,
    modelNumber: string,
  ): Promise<string> {
    // Generate filename based on product ID
    const filename = `qr-${productId}.png`;
    const filepath = path.join(this.uploadsDir, filename);

    // Generate QR code with model number as content
    await QRCode.toFile(filepath, modelNumber, {
      errorCorrectionLevel: 'H', // High error correction
      type: 'png',
      width: 300, // 300x300 pixels
      margin: 1, // Minimal margin
      color: {
        dark: '#000000', // Black
        light: '#FFFFFF', // White
      },
    });

    // Return relative path for database storage
    return `uploads/${filename}`;
  }

  /**
   * Update QR code when model number changes
   * Deletes old QR code and generates new one
   * @param productId - Unique product ID
   * @param newModelNumber - New model number to encode
   * @returns Relative path to the new QR code image
   */
  async updateProductQRCode(
    productId: string,
    newModelNumber: string,
  ): Promise<string> {
    // Delete old QR code if it exists
    const oldFilename = `qr-${productId}.png`;
    const oldFilepath = path.join(this.uploadsDir, oldFilename);

    if (fs.existsSync(oldFilepath)) {
      fs.unlinkSync(oldFilepath);
    }

    // Generate new QR code
    return this.generateProductQRCode(productId, newModelNumber);
  }

  /**
   * Delete QR code for a product
   * @param productId - Unique product ID
   */
  async deleteProductQRCode(productId: string): Promise<void> {
    const filename = `qr-${productId}.png`;
    const filepath = path.join(this.uploadsDir, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}
