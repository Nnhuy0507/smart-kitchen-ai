import os
from io import BytesIO
from pathlib import Path
from threading import Lock

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from torchvision import transforms
from .classifier import create_classifier

MODEL_PATH = Path(os.environ.get('CONVNEXT_CHECKPOINT', str(Path(__file__).resolve().parents[2] / 'model' / 'convnext_food_75.pth.tar')))
DEVICE = os.environ.get('CONVNEXT_DEVICE', 'cuda' if torch.cuda.is_available() else 'cpu')
THRESHOLD = float(os.environ.get('CONVNEXT_THRESHOLD', '0.5'))
if not 0 <= THRESHOLD <= 1:
    raise ValueError('CONVNEXT_THRESHOLD must be between 0 and 1')
checkpoint = torch.load(MODEL_PATH, map_location='cpu', weights_only=False)
ingredient_list = checkpoint['ingredient_list']
model = create_classifier(len(ingredient_list), checkpoint_path=MODEL_PATH).to(DEVICE).eval()
del checkpoint
model_lock = Lock()
preprocess = transforms.Compose([
    transforms.Resize((640, 640)), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
app = FastAPI(title='Smart Kitchen AI - ConvNeXt Food 75')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

@app.get('/health')
def health():
    return {'success': True, 'model': 'ConvNeXt-Food-CLF-75', 'device': DEVICE, 'classes': len(ingredient_list), 'threshold': THRESHOLD}

@app.post('/predict')
def predict(file: UploadFile = File(...)):
    if file.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise HTTPException(400, 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP')
    data = file.file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, 'Ảnh không được vượt quá 15 MB')
    try:
        with Image.open(BytesIO(data)) as image:
            tensor = preprocess(ImageOps.exif_transpose(image).convert('RGB')).unsqueeze(0).to(DEVICE)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(400, 'File gửi lên không phải ảnh hợp lệ')
    with model_lock, torch.inference_mode():
        probabilities = model(tensor).sigmoid()[0].cpu().tolist()
    # Count is an editable default; classification does not count objects.
    detections = [
        {'name': name, 'count': 1, 'confidence': round(score, 4)}
        for name, score in sorted(zip(ingredient_list, probabilities), key=lambda x: x[1], reverse=True)
        if score >= THRESHOLD
    ]
    return {'success': True, 'detections': detections, 'model': 'ConvNeXt-Food-CLF-75'}
