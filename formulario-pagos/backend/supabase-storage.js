const { createClient } = require('@supabase/supabase-js');

// Inicializar cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'gastos-imagenes';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Variables de Supabase no configuradas. Upload de archivos deshabilitado.');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Sube un archivo a Supabase Storage
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} fileName - Nombre del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadFile(fileBuffer, fileName, mimeType) {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase no está configurado'
    };
  }

  try {
    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = fileName.split('.').pop();
    const uniqueFileName = `${timestamp}-${randomStr}.${extension}`;
    const filePath = `uploads/${uniqueFileName}`;

    // Subir archivo a Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error al subir archivo a Supabase:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Obtener URL pública del archivo
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    console.log(`✓ Archivo subido a Supabase: ${uniqueFileName}`);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      fileName: fileName,
      storedFileName: uniqueFileName,
      size: fileBuffer.length,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error inesperado al subir archivo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Elimina un archivo de Supabase Storage
 * @param {string} filePath - Ruta del archivo en Supabase
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFile(filePath) {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase no está configurado'
    };
  }

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('Error al eliminar archivo de Supabase:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`✓ Archivo eliminado de Supabase: ${filePath}`);

    return {
      success: true
    };
  } catch (error) {
    console.error('Error inesperado al eliminar archivo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Valida si un archivo tiene un tipo permitido
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {boolean}
 */
function isValidFileType(mimeType) {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

  return allowedTypes.includes(mimeType);
}

/**
 * Obtiene extensión del archivo desde el MIME type
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {string}
 */
function getExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };

  return mimeToExt[mimeType] || 'bin';
}

module.exports = {
  uploadFile,
  deleteFile,
  isValidFileType,
  getExtensionFromMimeType,
  supabase
};
