import type {
  DocumentDetail as DocumentDetailDto,
  DocumentMetadata as DocumentMetadataDto,
} from '@cadenway/api-client';

import type { DocumentDetail, DocumentSummary } from '../../../models/document/document.interface';

/**
 * Function toDocumentSummary
 *
 * @description
 * Maps the gateway's document metadata to the catalog's model.
 *
 * @param {DocumentMetadataDto} dto - The listed document.
 * @returns {DocumentSummary} The display model.
 */
export function toDocumentSummary(dto: DocumentMetadataDto): DocumentSummary {
  return {
    id: dto.id,
    spaceId: dto.spaceId,
    title: dto.title,
    authorUserId: dto.authorUserId,
    updatedAt: dto.updatedAt,
    version: dto.version,
  };
}

/**
 * Function toDocumentDetail
 *
 * @description
 * Maps the gateway's document, with its Markdown body, to the document page's model.
 *
 * @param {DocumentDetailDto} dto - The read, created or saved document.
 * @returns {DocumentDetail} The display model.
 */
export function toDocumentDetail(dto: DocumentDetailDto): DocumentDetail {
  return { ...toDocumentSummary(dto), body: dto.body };
}
