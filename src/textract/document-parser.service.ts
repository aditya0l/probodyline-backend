import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentParserService {

  parsePANCard(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // PAN number: 10 chars, format ABCDE1234F
    const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
    const panMatches = rawText.match(panRegex);
    if (panMatches?.length) {
      result.panCardNumber = panMatches[0];
    }

    // Name on PAN card — usually appears after "Name" label
    // or on the line before the PAN number
    const namePatterns = [
      /name[:\s]+([A-Z\s]+)/i,
      /(?:^|\n)([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)/m
    ];
    for (const pattern of namePatterns) {
      const match = rawText.match(pattern);
      if (match?.[1] && match[1].trim().length > 2) {
        result.nameAsPanCard = match[1].trim();
        break;
      }
    }

    // From key-value pairs if available
    if (kvPairs['name']) result.nameAsPanCard = kvPairs['name'];
    if (kvPairs['permanent account number']) {
      result.panCardNumber = kvPairs['permanent account number'];
    }

    return result;
  }

  parseAadharCard(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // Aadhar number: 12 digits, usually in format XXXX XXXX XXXX
    const aadharRegex = /\d{4}\s\d{4}\s\d{4}/g;
    const aadharMatches = rawText.match(aadharRegex);
    if (aadharMatches?.length) {
      result.aadharCardNumber = aadharMatches[0].replace(/\s/g, '');
    }

    // Name — usually on first or second line of Aadhar
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Name lines are typically all caps or Title Case, no numbers
      if (
        /^[A-Za-z\s]{3,50}$/.test(line) &&
        !line.toLowerCase().includes('government') &&
        !line.toLowerCase().includes('india') &&
        !line.toLowerCase().includes('aadhaar') &&
        line.split(' ').length >= 2
      ) {
        result.nameAsAadharCard = line;
        break;
      }
    }

    // Date of Birth
    const dobRegex = /(?:DOB|Date of Birth)[:\s]+(\d{2}\/\d{2}\/\d{4})/i;
    const dobMatch = rawText.match(dobRegex);
    if (dobMatch) result.dateOfBirth = dobMatch[1];

    // Address — everything after "Address:" or "S/O", "W/O", "D/O"
    const addressRegex = /(?:Address|S\/O|W\/O|D\/O)[:\s]+(.+?)(?=\d{4}\s\d{4}|\d{6}|$)/is;
    const addressMatch = rawText.match(addressRegex);
    if (addressMatch) {
      result.addressAsAadharCard = addressMatch[1]
        .replace(/\n/g, ', ')
        .trim();
    }

    return result;
  }

  parseGSTCertificate(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // GST Number: 15 chars
    const gstRegex = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/g;
    const gstMatches = rawText.match(gstRegex);
    if (gstMatches?.length) {
      result.gstRegistrationNumber = gstMatches[0];
    }

    // Legal name
    const legalNamePatterns = [
      /legal name[:\s]+([^\n]+)/i,
      /trade name[:\s]+([^\n]+)/i
    ];
    for (const pattern of legalNamePatterns) {
      const match = rawText.match(pattern);
      if (match?.[1]) {
        if (pattern.source.includes('legal')) {
          result.legalName = match[1].trim();
        } else {
          result.tradeName = match[1].trim();
        }
      }
    }

    // From key-value pairs
    if (kvPairs['legal name of business']) {
      result.legalName = kvPairs['legal name of business'];
    }
    if (kvPairs['trade name']) {
      result.tradeName = kvPairs['trade name'];
    }
    if (kvPairs['principal place of business']) {
      result.principalAddress = kvPairs['principal place of business'];
    }
    if (kvPairs['additional place of business']) {
      result.additionalPlacesOfBusiness = 
        kvPairs['additional place of business'];
    }

    return result;
  }

  parseRentAgreement(rawText: string, kvPairs: Record<string, string>) {
    // Rent agreement has no standard format
    // Just return raw text for manual review
    return { rawText: rawText.substring(0, 500) };
  }

  parseBankCheque(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // Account number — 9-18 digits
    const accRegex = /(?:A\/C|Account|Acc)[.\s#:]*(\d{9,18})/i;
    const accMatch = rawText.match(accRegex);
    if (accMatch) result.accountNumber = accMatch[1];

    // IFSC: 11 chars starting with 4 letters
    const ifscRegex = /[A-Z]{4}0[A-Z0-9]{6}/g;
    const ifscMatches = rawText.match(ifscRegex);
    if (ifscMatches?.length) result.ifscCode = ifscMatches[0];

    // MICR: 9 digits
    const micrRegex = /\b\d{9}\b/g;
    const micrMatches = rawText.match(micrRegex);
    if (micrMatches?.length) result.micrCode = micrMatches[0];

    // Bank name from key-value pairs
    if (kvPairs['bank']) result.bankName = kvPairs['bank'];
    if (kvPairs['bank name']) result.bankName = kvPairs['bank name'];
    if (kvPairs['branch']) result.branchName = kvPairs['branch'];

    return result;
  }

  // Route to correct parser based on document type
  parseDocument(
    documentType: string,
    rawText: string,
    kvPairs: Record<string, string>
  ) {
    switch (documentType) {
      case 'PAN_CARD_CLIENT':
      case 'PAN_CARD_FIRM':
        return this.parsePANCard(rawText, kvPairs);
      case 'AADHAR_CARD':
        return this.parseAadharCard(rawText, kvPairs);
      case 'GST_CERTIFICATE':
        return this.parseGSTCertificate(rawText, kvPairs);
      case 'RENT_AGREEMENT':
        return this.parseRentAgreement(rawText, kvPairs);
      case 'BANK_DETAILS':
        return this.parseBankCheque(rawText, kvPairs);
      default:
        return {};
    }
  }
}
