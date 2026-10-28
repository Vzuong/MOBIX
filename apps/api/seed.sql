INSERT INTO products (
    name, brand, price, original_price, image,
    chip, screen, ram_rom, battery, rating, tag, description
) VALUES

-- ============================================================================
-- SẢN PHẨM MỚI 2026 (ĐỨNG ĐẦU DANH SÁCH)
-- ============================================================================

-- 1. Apple iPhone 18 Pro Max
(
    'iPhone 18 Pro Max 256GB',
    'Apple',
    41990000,
    NULL,
    'https://eplehuset.no/cdn/shop/files/iPhone_18_Pro_Max_Burgundy_PDP_Image_Position_1__no-NO_47b90b79-4d9e-4cee-91c9-78e8381445e8.png?v=1788993474&width=2200',
    'Apple A20 Pro',
    'Super Retina XDR OLED 6.9" 120Hz',
    '12GB / 256GB',
    'Pin tối ưu, sạc nhanh USB-C',
    4.9,
    'FLAGSHIP 2026',
    'Flagship cao cấp của Apple với chip A20 Pro, màn hình ProMotion 120Hz, camera Pro Fusion 48MP có khẩu độ tùy chỉnh và hiệu năng mạnh mẽ.'
),

-- 2. Apple iPhone 18 Pro
(
    'iPhone 18 Pro 256GB',
    'Apple',
    38990000,
    NULL,
    'https://assets.odido.nl/648x648/21f041d5de/hc-fg-c_apple_iphone-18-pro_front-back_black_648x648.webp',
    'Apple A20 Pro',
    'Super Retina XDR OLED 6.3" 120Hz',
    '12GB / 256GB',
    'Pin tối ưu, sạc nhanh USB-C',
    4.9,
    'PRO CAMERA',
    'Thiết kế cao cấp, màn hình ProMotion mượt mà, camera Pro Fusion 48MP và chip A20 Pro dành cho người dùng yêu cầu hiệu năng cao.'
),

-- 3. Apple iPhone Duo màn hình gập
(
    'iPhone Duo 256GB',
    'Apple',
    64999000,
    NULL,
    'https://cdn1.viettelstore.vn/Images/Product/ProductImage/875303633.png',
    'Apple A20 Pro',
    'OLED gập 7.6", màn hình ngoài 5.4"',
    '12GB / 256GB',
    'Pin kép, sạc USB-C',
    4.9,
    'APPLE FOLD',
    'iPhone màn hình gập cao cấp với màn hình trong 7.6 inch, màn hình ngoài 5.4 inch, khung titan và giao diện iOS tối ưu cho đa nhiệm.'
),

-- 4. Samsung Galaxy S26 Ultra
(
    'Samsung Galaxy S26 Ultra 5G 256GB',
    'Samsung',
    32990000,
    40990000,
    'https://www.lottedutyfree.com.au/cdn/shop/files/884046-Product-0-I-639058363204667625.jpg?v=1782171099',
    'Snapdragon 8 Elite Gen 5 for Galaxy',
    'Dynamic AMOLED 2X QHD+ 6.9" 120Hz',
    '12GB / 256GB',
    '5000 mAh, sạc nhanh USB-C',
    4.9,
    'GALAXY AI',
    'Flagship Samsung với màn hình QHD+ 120Hz, camera 200MP, bút S Pen tích hợp và các tính năng Galaxy AI hỗ trợ công việc hằng ngày.'
),

-- 5. Samsung Galaxy S26
(
    'Samsung Galaxy S26 5G 256GB',
    'Samsung',
    21990000,
    29990000,
    'https://altel.kz/images/eshop/1774379148-Samsung%20S26%20Cobalt%20Violet%20%282%29.png',
    'Samsung Exynos 2600',
    'Dynamic AMOLED 2X 6.3" 120Hz',
    '12GB / 256GB',
    '4300 mAh, sạc nhanh USB-C',
    4.9,
    'FLAGSHIP GỌN NHẸ',
    'Điện thoại flagship nhỏ gọn với màn hình 120Hz, chip Exynos 2600, camera đa dụng và các tính năng Galaxy AI.'
),

-- 6. Samsung Galaxy Z Fold8
(
    'Samsung Galaxy Z Fold8 5G 256GB',
    'Samsung',
    46990000,
    NULL,
    'https://shop.samsung.com/ie/images/products/30619/39368/2000x2000/H8Mid512.webp',
    'Snapdragon 8 Elite Gen 5 for Galaxy',
    'Dynamic AMOLED 2X trong 7.6", ngoài 5.5"',
    '12GB / 256GB',
    '4800 mAh, sạc nhanh 45W',
    4.9,
    'GẬP CAO CẤP',
    'Điện thoại gập dạng quyển sách với màn hình lớn phục vụ đa nhiệm, làm việc và giải trí, kết hợp hiệu năng flagship và trải nghiệm Galaxy AI.'
),

-- 7. Xiaomi 17 Ultra
(
    'Xiaomi 17 Ultra 5G 16GB/512GB',
    'Xiaomi',
    30490000,
    39990000,
    'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/361988/xiaomi-17-ultra-black-1-639088343209328798.jpg',
    'Snapdragon 8 Elite Gen 5',
    'Xiaomi HyperRGB OLED 6.9" 120Hz',
    '16GB / 512GB',
    '6000 mAh, sạc nhanh có dây và không dây',
    4.9,
    'LEICA 200MP',
    'Flagship thiên về nhiếp ảnh với hệ thống camera Leica, camera tele 200MP, cảm biến chính 1 inch và chip Snapdragon thế hệ mới.'
),

-- 8. Xiaomi 17T Pro
(
    'Xiaomi 17T Pro 5G 12GB/256GB',
    'Xiaomi',
    19790000,
    23990000,
    'https://cdn.shopify.com/s/files/1/0684/6332/9568/files/8fd3a28e982d72e15b18ab7eeef3c974.webp?v=1781714448',
    'MediaTek Dimensity 9500',
    'AMOLED 6.83" 144Hz',
    '12GB / 256GB',
    '7000 mAh, sạc nhanh 100W',
    4.9,
    'HIỆU NĂNG CAO',
    'Điện thoại hiệu năng cao với màn hình AMOLED tần số quét 144Hz, chip Dimensity 9500 và pin dung lượng lớn hỗ trợ sạc nhanh.'
),

-- 9. OPPO Find X9 Pro
(
    'OPPO Find X9 Pro 5G 16GB/512GB',
    'OPPO',
    32490000,
    NULL,
    'https://bizweb.dktcdn.net/thumb/1024x1024/100/506/962/products/oppo-find-x9-pro-trang-3db96955-ede1-4b50-896e-24e3afd7faaa.jpg?v=1773231600963',
    'MediaTek Dimensity 9500',
    'LTPO AMOLED 6.78" 120Hz',
    '16GB / 512GB',
    '7500 mAh, sạc nhanh 80W',
    4.8,
    'CHÂN DUNG HASSELBLAD',
    'Flagship OPPO chú trọng chụp ảnh với hệ thống camera cao cấp, camera tele 200MP, màn hình LTPO AMOLED và pin dung lượng lớn.'
),

-- 10. vivo X300 Ultra
(
    'vivo X300 Ultra 5G 16GB/512GB',
    'Vivo',
    35990000,
    49990000,
    'https://vivoonlinestore.com/cdn/shop/files/vivo-x300-ultra-procesador-qualcomm-snapdragon-8-elite-gen-5.png?v=1779968519&width=2000',
    'Snapdragon 8 Elite Gen 5',
    'AMOLED QHD+ 6.82" 144Hz',
    '16GB / 512GB',
    '6600 mAh, sạc 100W, sạc không dây 40W',
    5.0,
    'ZEISS 200MP',
    'Flagship nhiếp ảnh hợp tác cùng ZEISS với hệ thống camera độ phân giải cao, màn hình QHD+ 144Hz và khả năng sạc nhanh 100W.'
),

-- 11. realme GT8 Pro hàng xách tay
(
    'realme GT8 Pro 5G 16GB/512GB',
    'Realme',
    18490000,
    NULL,
    'https://cdn.beebom.com/mobile/realme-gt-8-pro-front-back-2.png',
    'Snapdragon 8 Elite Gen 5',
    'AMOLED 2K 6.79" 144Hz',
    '16GB / 512GB',
    '7000 mAh, sạc 120W, sạc không dây 50W',
    4.8,
    'GAMING XÁCH TAY',
    'Flagship hiệu năng cao với chip Snapdragon thế hệ mới, hệ thống camera RICOH GR, màn hình 2K 144Hz và pin Titan 7000 mAh. Giá tham khảo phiên bản xách tay.'
),

-- 12. realme 16T
(
    'realme 16T 5G 8GB/128GB',
    'Realme',
    9590000,
    10290000,
    'https://welectronics.com/images/stories/virtuemart/product/Realme16T5Gblack45.jpg',
    'MediaTek Dimensity 6300',
    'LCD 6.8" 144Hz',
    '8GB / 128GB',
    '8000 mAh, sạc nhanh 45W',
    5.0,
    'PIN TITAN 8000',
    'Điện thoại tầm trung hướng đến thời lượng pin dài với viên pin Titan 8000 mAh, màn hình 144Hz, camera 50MP và sạc nhanh 45W.'
),

-- ============================================================================
-- SẢN PHẨM HIỆN CÓ (DỒN XUỐNG DƯỚI)
-- ============================================================================

-- 13. iPhone 16 Pro Max
(
    'iPhone 16 Pro Max 256GB',
    'Apple',
    34990000,
    36990000,
    'https://www.techone.vn/wp-content/uploads/2024/09/trang.jpg',
    'Apple A18 Pro',
    'OLED 6.9" 120Hz',
    '8GB / 256GB',
    '4685 mAh, Sạc nhanh 30W',
    4.9,
    'FLAGSHIP MỚI',
    'Khung titan sa mạc sang trọng, camera zoom 5x, nút điều khiển camera chuyên nghiệp, chip A18 Pro mạnh mẽ.'
),

-- 14. Samsung Galaxy S24 Ultra
(
    'Samsung Galaxy S24 Ultra 5G',
    'Samsung',
    27990000,
    31990000,
    'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/s/s/ss-s24-ultra-xam-222_1_1.png',
    'Snapdragon 8 Gen 3',
    'Dynamic AMOLED 2X 6.8"',
    '12GB / 256GB',
    '5000 mAh, Sạc 45W',
    4.9,
    'GALAXY AI',
    'Trợ lý quyền năng Galaxy AI, bút S-Pen tích hợp, khung viền titan siêu bền, camera zoom mắt thần 200MP.'
),

-- 15. iPhone 15
(
    'iPhone 15 128GB',
    'Apple',
    19490000,
    21990000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Back_of_iPhone_15.jpg/960px-Back_of_iPhone_15.jpg',
    'Apple A16 Bionic',
    'Super Retina XDR 6.1"',
    '6GB / 128GB',
    '3349 mAh, MagSafe',
    4.8,
    'BÁN CHẠY',
    'Màn hình Dynamic Island sáng tạo, camera 48MP sắc nét, cổng kết nối Type-C tiện lợi và kính lưng pha màu tuyệt đẹp.'
),

-- 16. Xiaomi 14 Ultra
(
    'Xiaomi 14 Ultra 5G',
    'Xiaomi',
    26990000,
    29990000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_Mi_11_Ultra_back.jpg/960px-Xiaomi_Mi_11_Ultra_back.jpg',
    'Snapdragon 8 Gen 3',
    'AMOLED 2K 6.73" 120Hz',
    '16GB / 512GB',
    '5000 mAh, Sạc 90W',
    4.8,
    'LEICA ĐỈNH CAO',
    'Hệ thống 4 camera Leica cảm biến 1 inch khẩu độ vô cấp, tản nhiệt buồng hơi lỏng, sạc siêu tốc 90W.'
),

-- 17. Samsung Galaxy Z Flip6
(
    'Samsung Galaxy Z Flip6 5G',
    'Samsung',
    21990000,
    26990000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Samsung_Galaxy_Z_Flip_5G.png/960px-Samsung_Galaxy_Z_Flip_5G.png',
    'Snapdragon 8 Gen 3',
    'Dynamic AMOLED 2X 6.7"',
    '12GB / 256GB',
    '4000 mAh, Kháng nước IP48',
    4.7,
    'GẬP THỜI THƯỢNG',
    'Thiết kế gập vỏ sò nhỏ gọn bỏ túi, FlexCam chụp ảnh rảnh tay, tính năng dịch thuật trực tiếp 2 màn hình.'
),

-- 18. Google Pixel 9 Pro XL
(
    'Google Pixel 9 Pro XL',
    'Google',
    24500000,
    27000000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Google_Pixel_9_Pro_XL_%28back%29.jpg/960px-Google_Pixel_9_Pro_XL_%28back%29.jpg',
    'Google Tensor G4',
    'Super Actua LTPO 6.8"',
    '16GB / 256GB',
    '5060 mAh, Sạc 37W',
    4.8,
    'CHUẨN GEMINI AI',
    'Nhiếp ảnh điện toán đỉnh cao cùng thuật toán AI Google độc quyền, hỗ trợ cập nhật Android 7 năm liên tục.'
),

-- 19. ASUS ROG Phone 8 Pro
(
    'ASUS ROG Phone 8 Pro',
    'Asus',
    28990000,
    31990000,
    'https://cdn2.cellphones.com.vn/x/media/catalog/product/a/s/asus-rog-phone-8.png',
    'Snapdragon 8 Gen 3',
    'AMOLED 6.78" 165Hz',
    '16GB / 512GB',
    '5500 mAh, AirTrigger',
    4.9,
    'QUÁI VẬT GAMING',
    'Cỗ máy chơi game đỉnh cao với phím siêu âm AirTrigger, màn hình 165Hz siêu mượt, hệ thống AniMe Vision mặt lưng.'
),

-- 20. Poco F6 Pro
(
    'Poco F6 Pro 5G',
    'Xiaomi',
    12490000,
    14990000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Xiaomi_Poco_F1_on_Wikipedia.jpg/960px-Xiaomi_Poco_F1_on_Wikipedia.jpg',
    'Snapdragon 8 Gen 2',
    'Flow AMOLED 2K 120Hz',
    '12GB / 512GB',
    '5000 mAh, Sạc 120W',
    4.7,
    'HIỆU NĂNG VÔ ĐỊCH',
    'Hiệu năng gaming cực khủng trong tầm giá, sạc siêu nhanh 120W HyperCharge đầy pin trong 19 phút.'
),

-- 21. Samsung Galaxy A55
(
    'Samsung Galaxy A55 5G',
    'Samsung',
    9190000,
    10490000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Back_of_the_Samsung_Galaxy_A54_5G.jpg/960px-Back_of_the_Samsung_Galaxy_A54_5G.jpg',
    'Exynos 1480',
    'Super AMOLED 6.6" 120Hz',
    '8GB / 128GB',
    '5000 mAh, Kháng nước IP67',
    4.6,
    'QUỐC DÂN TẦM TRUNG',
    'Khung kim loại sang chảnh chuẩn flagship, mặt lưng kính cường lực Gorilla Glass Victus+, bảo mật Knox Vault.'
),

-- 22. Vivo X100 Pro
(
    'Vivo X100 Pro 5G',
    'Vivo',
    18990000,
    22000000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/The_back_of_the_vivo_X300_Pro.jpg/960px-The_back_of_the_vivo_X300_Pro.jpg',
    'Dimensity 9300',
    'AMOLED 1.5K 120Hz',
    '16GB / 512GB',
    '5400 mAh, Sạc 100W',
    4.8,
    'CHÂN DUNG ZEISS',
    'Hợp tác cùng thương hiệu quang học huyền thoại ZEISS, chip hình ảnh Vivo V3 chuyên biệt chụp đêm.'
),

-- 23. iPhone 13
(
    'iPhone 13 128GB',
    'Apple',
    13590000,
    16990000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Back_of_the_iPhone_13_Pro.jpg/960px-Back_of_the_iPhone_13_Pro.jpg',
    'Apple A15 Bionic',
    'Super Retina XDR 6.1"',
    '4GB / 128GB',
    '3240 mAh, Chống nước IP68',
    4.7,
    'GIÁ TỐT NHẤT',
    'Lựa chọn bền bỉ theo năm tháng với hiệu năng mượt mà, camera kép chéo chống rung OIS và thời lượng pin ấn tượng.'
),

-- 24. OPPO Reno12 Pro
(
    'OPPO Reno12 Pro 5G',
    'OPPO',
    15990000,
    18990000,
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/OPPO_Reno_6_Pro%2B_back.jpg/960px-OPPO_Reno_6_Pro%2B_back.jpg',
    'Dimensity 7300-Energy',
    'AMOLED cong 3D 6.7"',
    '12GB / 512GB',
    '5000 mAh, Sạc 80W',
    4.7,
    'CHUYÊN GIA AI',
    'Nhiếp ảnh chân dung AI thông minh (AI Eraser, AI Clear Face), thiết kế lưng bạc vũ trụ siêu mỏng nhẹ.'
);
