export const recordId = value => typeof value === 'object' && value ? value._id : value;
export function validatePhotos(files) {
 if (files.length > 5) return 'Choose at most 5 photos.';
 if (files.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type))) return 'Use JPG, PNG or WebP images.';
 if (files.some(file => file.size > 5 * 1024 * 1024)) return 'Each photo must be 5 MB or smaller.';
 return '';
}
export function resolutionError({files, remarks, capabilities}) {
 const photoError = validatePhotos(files);
 if (photoError) return photoError;
 if (!files.length && !capabilities?.textOnlyResolution) return 'Add at least one resolution photo before submitting.';
 if (!files.length && remarks.trim().length < 20) return 'Describe the completed work in at least 20 characters.';
 return '';
}
