const multer = require('multer');
const path = require('path');

// Memory storage: files stay in req.file.buffer and are uploaded
// to Supabase Storage (free persistent object storage).
// Local disk (../../uploads) is ephemeral on Render/Railway and gets wiped.
const storage = multer.memoryStorage();

const imageTypes = /jpeg|jpg|png|webp|gif/;
const documentTypes = /jpeg|jpg|png|webp|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv/;

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  
  if (file.fieldname === 'file') {
    if (documentTypes.test(ext) || documentTypes.test(file.mimetype)) {
      return cb(null, true);
    }
  } else if (file.fieldname === 'image') {
    if (imageTypes.test(ext) && imageTypes.test(file.mimetype)) {
      return cb(null, true);
    }
  }
  
  cb(new Error(`File type not allowed: ${ext}. Images: jpeg, jpg, png, webp, gif. Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv`));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

module.exports = upload;
