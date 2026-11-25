# Nhận diện nguyên liệu bằng ConvNeXt

Từ thư mục backend, chạy npm start. API POST /api/scan tự nạp ConvNeXt khi nhận ảnh đầu tiên và tái sử dụng model cho các lượt sau. Tiến trình Python dừng cùng backend.

## Thiết lập Python trên máy mới

Từ `smart-kitchen-ai/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-ai.txt
```

Backend ưu tiên Python trong `.venv`. Dùng `AI_PYTHON` để chỉ định trình Python
khác. Đặt checkpoint đã train tại `model/convnext_food_75.pth.tar`.
Kiến trúc và mã suy luận nằm trong `src/convnext_service/`.

## Luồng xử lý

App gửi multipart với trường `file` tới `/api/scan` trên URL backend. Backend
chuyển ảnh tới tiến trình Python qua loopback. API nhận JPG, PNG và WebP tối đa
15 MB. Model đổi kích thước ảnh về 640×640, chuẩn hóa theo ImageNet và trả
nhãn đạt ngưỡng. 75 nhãn được đọc từ checkpoint. `count: 1` là giá trị mặc định
có thể chỉnh sửa trên màn xác nhận.

- `CONVNEXT_CHECKPOINT` đặt đường dẫn đến checkpoint tin cậy khác.
- `CONVNEXT_DEVICE` chọn `cpu` hoặc `cuda`. Mặc định PyTorch tự chọn.
- `CONVNEXT_THRESHOLD` đặt ngưỡng từ 0 đến 1, mặc định `0.5`.

Nguồn model: https://huggingface.co/Alas-V/ConvNeXt-Food-CLF-75.
Giấy phép Apache 2.0 nằm trong `src/convnext_service/LICENSE-ConvNeXt`.
