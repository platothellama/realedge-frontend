const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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
