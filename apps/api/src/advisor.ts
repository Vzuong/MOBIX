import type { Product } from './index'

export interface ExtractedIntent {
  raw: string
  normalized: string
  // Budgets (in VND)
  minBudget?: number
  maxBudget?: number
  targetBudget?: number
  isValueForMoney?: boolean

  // Core needs
  wantsPhoto?: boolean
  wantsVideo?: boolean
  wantsGaming?: boolean
  wantsBattery?: boolean
  wantsFoldable?: boolean
  wantsAI?: boolean
  wantsWorkStudy?: boolean
  wantsCompact?: boolean

  // Special intents
  isComparison?: boolean
  isGeneralBest?: boolean
  isPolicy?: boolean

  // Brand preference
  brandPreference?: string

  // Specific model mentions
  specificModel?: string
}

export interface ScoredProduct {
  product: Product
  score: number
  reasons: string[]
  tradeOffs: string[]
}

export interface ChatResponse {
  reply: string
  suggestions: string[]
  products: Product[]
}

// Format VND currency for text
export function formatVnd(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)} triệu`
  }
  return `${(amount / 1_000).toFixed(0)}k`
}

// 1. Phân tích ý định người dùng (Intent Parser)
export function extractIntent(message: string): ExtractedIntent {
  const raw = message.trim()
  const lower = raw.toLowerCase()

  // Chuẩn hoá một số từ viết tắt phổ biến
  const normalized = lower
    .replace(/\bip\b/g, 'iphone')
    .replace(/\bss\b/g, 'samsung')
    .replace(/\bmi\b/g, 'xiaomi')
    .replace(/\bcủ\b/g, 'triệu')
    .replace(/\btr\b/g, 'triệu')
    .replace(/\bm\b/g, 'triệu')

  const intent: ExtractedIntent = {
    raw,
    normalized,
  }

  // --- Parse Budget ---
  // Dưới X triệu
  const underMatch = normalized.match(/(?:dưới|tầm dưới|nhỏ hơn|<|dưới mức)\s*(\d+(?:[.,]\d+)?)\s*triệu/i)
  if (underMatch) {
    const val = parseFloat(underMatch[1].replace(',', '.'))
    intent.maxBudget = val * 1_000_000
  }

  // Khoảng / Tầm / Tầm giá X triệu
  const approxMatch = normalized.match(/(?:khoảng|tầm|quanh|xung quanh|tầm khoảng)\s*(\d+(?:[.,]\d+)?)\s*triệu/i)
  if (approxMatch) {
    const val = parseFloat(approxMatch[1].replace(',', '.'))
    intent.targetBudget = val * 1_000_000
    intent.minBudget = Math.max(0, (val - 3) * 1_000_000)
    intent.maxBudget = (val + 3.5) * 1_000_000
  }

  // Từ X đến Y triệu
  const rangeMatch = normalized.match(/từ\s*(\d+(?:[.,]\d+)?)\s*(?:đến|-)\s*(\d+(?:[.,]\d+)?)\s*triệu/i)
  if (rangeMatch) {
    const minVal = parseFloat(rangeMatch[1].replace(',', '.'))
    const maxVal = parseFloat(rangeMatch[2].replace(',', '.'))
    intent.minBudget = minVal * 1_000_000
    intent.maxBudget = maxVal * 1_000_000
  }

  // X triệu đổ lại / quay đầu
  const capMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*triệu\s*(?:đổ lại|quay đầu|trở xuống)/i)
  if (capMatch) {
    const val = parseFloat(capMatch[1].replace(',', '.'))
    intent.maxBudget = val * 1_000_000
  }

  // "Tao có 10 triệu" / "ngân sách 10 triệu" / "10 triệu nên mua máy nào"
  const exactHaveMatch = normalized.match(/(?:có|ngân sách|tài chính|cầm|với)\s*(\d+(?:[.,]\d+)?)\s*triệu/i)
  if (exactHaveMatch && !intent.maxBudget) {
    const val = parseFloat(exactHaveMatch[1].replace(',', '.'))
    intent.targetBudget = val * 1_000_000
    intent.maxBudget = val * 1_000_000 + 1_000_000 // cho phép dư tối đa 1 triệu nếu có lựa chọn tốt
  } else if (!intent.maxBudget && !intent.targetBudget) {
    const standaloneMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*triệu/i)
    if (standaloneMatch) {
      const val = parseFloat(standaloneMatch[1].replace(',', '.'))
      intent.targetBudget = val * 1_000_000
      intent.maxBudget = val * 1_000_000 + 1_000_000
    }
  }

  // Giá rẻ / tiết kiệm / học sinh / sinh viên
  if (
    normalized.includes('giá rẻ') ||
    normalized.includes('tiết kiệm') ||
    normalized.includes('sinh viên') ||
    normalized.includes('học sinh') ||
    normalized.includes('bình dân') ||
    normalized.includes('tầm trung')
  ) {
    if (!intent.maxBudget) {
      intent.maxBudget = 15_000_000
    }
    intent.isValueForMoney = true
  }

  // "trong tầm giá" / "p/p" / "đáng tiền"
  if (
    normalized.includes('trong tầm giá') ||
    normalized.includes('tầm giá') ||
    normalized.includes('p/p') ||
    normalized.includes('đáng tiền') ||
    normalized.includes('ngon bổ rẻ')
  ) {
    intent.isValueForMoney = true
  }

  // --- Parse Core Needs ---
  // 1. Chụp ảnh (Photo)
  const isCasualPhoto =
    normalized.includes('thỉnh thoảng chụp') ||
    normalized.includes('ít chụp') ||
    normalized.includes('ít khi chụp') ||
    normalized.includes('chụp cơ bản') ||
    normalized.includes('thỉnh thoảng mới chụp')

  if (
    !isCasualPhoto &&
    (normalized.includes('chụp') ||
      normalized.includes('ảnh') ||
      normalized.includes('camera') ||
      normalized.includes('sống ảo') ||
      normalized.includes('chân dung') ||
      normalized.includes('phong cảnh') ||
      normalized.includes('zoom') ||
      normalized.includes('tele') ||
      normalized.includes('leica') ||
      normalized.includes('zeiss') ||
      normalized.includes('hasselblad') ||
      normalized.includes('chụp đêm') ||
      normalized.includes('nhiếp ảnh'))
  ) {
    intent.wantsPhoto = true
  }

  // 2. Quay phim (Video) - phân biệt rõ với chụp ảnh!
  if (
    normalized.includes('quay phim') ||
    normalized.includes('quay video') ||
    normalized.includes('quay clip') ||
    normalized.includes('quay tiktok') ||
    normalized.includes('tiktok') ||
    normalized.includes('vlog') ||
    normalized.includes('vlogger') ||
    normalized.includes('youtube') ||
    normalized.includes('youtuber') ||
    normalized.includes('reels') ||
    normalized.includes('làm video') ||
    normalized.includes('làm clip') ||
    normalized.includes('chuyên quay') ||
    (normalized.includes('quay') && !normalized.includes('quay đầu'))
  ) {
    intent.wantsVideo = true
  }

  // 3. Gaming & Hiệu năng
  if (
    normalized.includes('game') ||
    normalized.includes('gaming') ||
    normalized.includes('chơi game') ||
    normalized.includes('chiến game') ||
    normalized.includes('fps') ||
    normalized.includes('giả lập') ||
    normalized.includes('genshin') ||
    normalized.includes('liên quân') ||
    normalized.includes('pubg') ||
    normalized.includes('tốc chiến') ||
    normalized.includes('đồ họa') ||
    normalized.includes('cấu hình') ||
    normalized.includes('hiệu năng') ||
    normalized.includes('mượt mà') ||
    normalized.includes('snapdragon') ||
    normalized.includes('quái vật')
  ) {
    intent.wantsGaming = true
  }

  // 4. Pin trâu & Thời lượng sử dụng
  if (
    normalized.includes('pin') ||
    normalized.includes('trâu') ||
    normalized.includes('dùng lâu') ||
    normalized.includes('ít sạc') ||
    normalized.includes('8000') ||
    normalized.includes('7000') ||
    normalized.includes('mah') ||
    normalized.includes('thời lượng pin')
  ) {
    intent.wantsBattery = true
  }

  // 5. Điện thoại gập
  if (
    normalized.includes('gập') ||
    normalized.includes('fold') ||
    normalized.includes('flip') ||
    normalized.includes('duo') ||
    normalized.includes('vỏ sò') ||
    normalized.includes('màn hình gập')
  ) {
    intent.wantsFoldable = true
  }

  // 6. AI
  if (
    normalized.includes('ai') ||
    normalized.includes('galaxy ai') ||
    normalized.includes('gemini') ||
    normalized.includes('trí tuệ nhân tạo')
  ) {
    intent.wantsAI = true
  }

  // 7. Học tập, làm việc hằng ngày
  if (
    normalized.includes('học tập') ||
    normalized.includes('học') ||
    normalized.includes('làm việc') ||
    normalized.includes('văn phòng') ||
    normalized.includes('công việc') ||
    normalized.includes('hằng ngày') ||
    normalized.includes('tác vụ')
  ) {
    intent.wantsWorkStudy = true
  }

  // 8. Kích thước nhỏ gọn
  if (
    normalized.includes('nhỏ gọn') ||
    normalized.includes('gọn nhẹ') ||
    normalized.includes('không quá to') ||
    normalized.includes('vừa tay') ||
    normalized.includes('bé') ||
    normalized.includes('gọn')
  ) {
    intent.wantsCompact = true
  }

  // 9. So sánh
  if (
    normalized.includes('so sánh') ||
    normalized.includes('máy nào hơn') ||
    normalized.includes('máy nào tốt hơn') ||
    normalized.includes('hay là') ||
    (normalized.includes('với') && (normalized.includes('iphone') || normalized.includes('xiaomi') || normalized.includes('samsung'))) ||
    normalized.includes('giữa')
  ) {
    intent.isComparison = true
  }

  // 10. Câu hỏi chung: "tốt nhất hiện tại", "đáng mua nhất", "máy nào ngon nhất"
  if (
    normalized.includes('tốt nhất') ||
    normalized.includes('ngon nhất') ||
    normalized.includes('đáng mua nhất') ||
    normalized.includes('đỉnh nhất') ||
    normalized.includes('xịn nhất') ||
    normalized.includes('toàn diện nhất') ||
    normalized.includes('flagship nào')
  ) {
    // Nếu không có nhu cầu hẹp như camera, gaming, pin, fold thì đây là general best
    if (!intent.wantsPhoto && !intent.wantsVideo && !intent.wantsGaming && !intent.wantsBattery && !intent.wantsFoldable) {
      intent.isGeneralBest = true
    }
  }

  // 11. Chính sách trả góp / bảo hành
  if (
    normalized.includes('trả góp') ||
    normalized.includes('bảo hành') ||
    normalized.includes('khuyến mãi') ||
    normalized.includes('ưu đãi') ||
    normalized.includes('giao hàng') ||
    normalized.includes('ship')
  ) {
    intent.isPolicy = true
  }

  // 12. Hãng ưa chuộng
  if (normalized.includes('iphone') || normalized.includes('apple') || normalized.includes('ios')) {
    intent.brandPreference = 'Apple'
  } else if (normalized.includes('samsung') || normalized.includes('galaxy')) {
    intent.brandPreference = 'Samsung'
  } else if (normalized.includes('xiaomi') || normalized.includes('poco') || normalized.includes('redmi')) {
    intent.brandPreference = 'Xiaomi'
  } else if (normalized.includes('realme')) {
    intent.brandPreference = 'Realme'
  } else if (normalized.includes('oppo') || normalized.includes('reno')) {
    intent.brandPreference = 'OPPO'
  } else if (normalized.includes('vivo')) {
    intent.brandPreference = 'Vivo'
  } else if (normalized.includes('google') || normalized.includes('pixel')) {
    intent.brandPreference = 'Google'
  } else if (normalized.includes('asus') || normalized.includes('rog')) {
    intent.brandPreference = 'Asus'
  }

  return intent
}

// 2. Chấm điểm từng sản phẩm dựa trên nhu cầu (Scoring & Ranking)
export function scoreAndRankProducts(products: Product[], intent: ExtractedIntent): ScoredProduct[] {
  const scoredList: ScoredProduct[] = products.map((p) => {
    let score = 50
    const reasons: string[] = []
    const tradeOffs: string[] = []

    const nameLower = p.name.toLowerCase()
    const descLower = p.description.toLowerCase()
    const chipLower = p.chip.toLowerCase()
    const screenLower = p.screen.toLowerCase()
    const tagLower = p.tag.toLowerCase()
    const batteryLower = p.battery.toLowerCase()

    // Trích xuất dung lượng pin dạng số (mAh)
    const batteryMatch = p.battery.match(/(\d{4})\s*mah/i)
    const batteryMah = batteryMatch ? parseInt(batteryMatch[1], 10) : 4500

    // --- Xử lý ngân sách nghiêm ngặt ---
    if (intent.maxBudget) {
      if (p.price > intent.maxBudget * 1.05) {
        // Vượt quá ngân sách: loại trừ hoặc phạt cực nặng
        score -= 10000
        tradeOffs.push(`Vượt quá ngân sách dự kiến (${formatVnd(p.price)} so với mức ${formatVnd(intent.maxBudget)})`)
      } else {
        score += 80
        reasons.push(`Nằm trong tầm ngân sách phù hợp (${formatVnd(p.price)})`)
      }
    }

    if (intent.minBudget && p.price < intent.minBudget * 0.75) {
      score -= 300
    }

    // Nếu hỏi "trong tầm giá" / value for money
    if (intent.isValueForMoney) {
      if (nameLower.includes('gt8 pro') || nameLower.includes('poco f6 pro') || nameLower.includes('17t pro')) {
        score += 60
        reasons.push('Tỉ lệ cấu hình trên giá thành (P/P) cực kỳ ấn tượng')
      }
      if (nameLower.includes('a55') || nameLower.includes('16t')) {
        score += 40
        reasons.push('Mức giá dễ tiếp cận, đáp ứng bền bỉ')
      }
    }

    // --- A. Chụp ảnh ---
    if (intent.wantsPhoto) {
      if (nameLower.includes('17 ultra')) {
        score += 150
        reasons.push('Cảm biến chính 1 inch, hệ thống camera Leica và camera tele 200MP chuyên sâu')
        tradeOffs.push('Cụm camera lồi đáng kể và thân máy đầm tay')
      } else if (nameLower.includes('x300 ultra')) {
        score += 140
        reasons.push('Hệ thống camera ZEISS 200MP độ phân giải cao và màn hình 144Hz sắc nét')
        tradeOffs.push('Mức giá thuộc phân khúc cao cấp (35.99 triệu)')
      } else if (nameLower.includes('find x9 pro')) {
        score += 130
        reasons.push('Camera tele 200MP kết hợp tinh chỉnh màu sắc chân dung Hasselblad')
        tradeOffs.push('Thiết kế màn hình lớn 6.78 inch')
      } else if (nameLower.includes('x100 pro')) {
        score += 125
        reasons.push('Camera ZEISS cùng chip xử lý hình ảnh Vivo V3 tối ưu chụp đêm, giá dưới 20 triệu')
        tradeOffs.push('Là model thế hệ trước so với X300 Ultra')
      } else if (nameLower.includes('14 ultra')) {
        score += 120
        reasons.push('Hệ thống 4 camera Leica cảm biến 1 inch với giá thấp hơn Xiaomi 17 Ultra')
        tradeOffs.push('Thời lượng pin 5000mAh ở mức tiêu chuẩn, chưa lớn bằng dòng 17 Ultra')
      } else if (nameLower.includes('s26 ultra') || nameLower.includes('s24 ultra')) {
        score += 110
        reasons.push('Camera 200MP đa năng, zoom mắt thần và thuật toán xử lý ảnh thông minh')
        tradeOffs.push('Ảnh ban đêm có xu hướng xử lý thuật toán sáng rõ hơn tông màu thực tế')
      } else if (nameLower.includes('pixel 9 pro xl')) {
        score += 105
        reasons.push('Nhiếp ảnh điện toán AI Google độc quyền, màu sắc chân thực')
        tradeOffs.push('Tốc độ sạc 37W không quá nhanh so với các đối thủ Android')
      } else if (nameLower.includes('reno12 pro')) {
        score += 90
        reasons.push('Chuyên gia chụp ảnh chân dung tích hợp tính năng AI Eraser thông minh')
        tradeOffs.push('Hiệu năng chip Dimensity 7300-Energy ở mức tầm trung')
      } else if (nameLower.includes('18 pro max') || nameLower.includes('18 pro') || nameLower.includes('16 pro max')) {
        score += 85
        reasons.push('Camera Pro Fusion sắc nét, màu sắc tự nhiên và tương thích tốt mọi ứng dụng')
        tradeOffs.push('Thiên về quay video và tính chân thực hơn là các bộ lọc màu nghệ thuật chuyên sâu')
      } else if (descLower.includes('camera') || tagLower.includes('camera')) {
        score += 30
      }
    }

    // --- B. Quay phim (Video / TikTok / Vlog / YouTube) ---
    if (intent.wantsVideo) {
      if (nameLower.includes('18 pro max')) {
        score += 160
        reasons.push('Khả năng quay video Pro Fusion 48MP tùy chỉnh khẩu độ, chống rung hàng đầu và tối ưu tốt nhất cho TikTok/Vlog')
        tradeOffs.push('Mức giá thuộc phân khúc cao nhất (41.99 triệu)')
      } else if (nameLower.includes('18 pro')) {
        score += 150
        reasons.push('Hiệu năng quay video chuyên nghiệp từ chip A20 Pro trong thân máy 6.3 inch gọn gàng')
        tradeOffs.push('Màn hình nhỏ hơn bản Pro Max, thời lượng pin tối ưu vừa phải')
      } else if (nameLower.includes('16 pro max')) {
        score += 135
        reasons.push('Nút điều khiển Camera Control chuyên dụng, chống rung ổn định và màu video nhất quán')
        tradeOffs.push('Dù giá tốt hơn iPhone 18 Pro Max nhưng vẫn ở mức cao (34.99 triệu)')
      } else if (nameLower.includes('iphone 15') || nameLower.includes('iphone 13')) {
        score += 110
        reasons.push('Hệ điều hành iOS tối ưu thuật toán quay video mượt mà trên TikTok/Instagram với chi phí tiết kiệm')
        tradeOffs.push('Không có ống kính tele chuyên dụng và giới hạn tần số quét màn hình 60Hz')
      } else if (nameLower.includes('17 ultra')) {
        score += 105
        reasons.push('Hệ màu Leica điện ảnh và khả năng zoom tele 200MP đa dạng tiêu cự khi quay phim')
        tradeOffs.push('Video trên ứng dụng bên thứ ba (như TikTok) đôi khi không tối ưu bằng iOS')
      } else if (nameLower.includes('x300 ultra')) {
        score += 100
        reasons.push('Độ phân giải video cao và hệ thống chống rung ZEISS tiên tiến')
        tradeOffs.push('Tập trung nhiều vào ảnh tĩnh hơn là các công cụ biên tập video nhanh')
      }
    }

    // --- C. Chơi game và hiệu năng ---
    if (intent.wantsGaming) {
      if (nameLower.includes('rog phone 8 pro')) {
        score += 150
        reasons.push('Thiết kế thuần gaming với phím siêu âm AirTrigger, màn hình 165Hz siêu mượt và hệ thống tản nhiệt buồng hơi')
        tradeOffs.push('Thiết kế hầm hố, trọng lượng nặng và giá thành cao (28.99 triệu)')
      } else if (nameLower.includes('gt8 pro')) {
        score += 145
        reasons.push('Trang bị Snapdragon 8 Elite Gen 5, màn hình 2K 144Hz, pin 7000mAh sạc nhanh 120W với mức giá rất hấp dẫn')
        tradeOffs.push('Đây là phiên bản xách tay, cần lưu ý về chính sách cập nhật ROM và thông báo')
      } else if (nameLower.includes('17t pro')) {
        score += 135
        reasons.push('Chip Dimensity 9500 thế hệ mới, màn hình 144Hz cùng viên pin lớn 7000mAh sạc siêu tốc 100W')
        tradeOffs.push('Cụm camera thiên về đa dụng hơn là cảm biến 1 inch chuyên sâu')
      } else if (nameLower.includes('poco f6 pro')) {
        score += 130
        reasons.push('Snapdragon 8 Gen 2, màn hình 2K 120Hz và sạc siêu tốc 120W (đầy trong 19 phút) với giá chỉ hơn 12 triệu')
        tradeOffs.push('Khả năng chụp ảnh ở mức vừa phải, thân máy nóng khi chiến game nặng kéo dài')
      } else if (chipLower.includes('snapdragon 8 elite') || chipLower.includes('a20 pro')) {
        score += 70
        reasons.push('Chipset đầu bảng xử lý mượt mà mọi tựa game nặng')
      } else if (chipLower.includes('dimensity 9500') || chipLower.includes('snapdragon 8 gen 3')) {
        score += 55
        reasons.push('Hiệu năng xử lý đồ họa mạnh mẽ')
      }

      // Bonus tần số quét màn hình
      if (screenLower.includes('165hz')) score += 30
      else if (screenLower.includes('144hz')) score += 20
      else if (screenLower.includes('120hz')) score += 10
    }

    // --- D. Pin trâu và thời lượng sử dụng ---
    if (intent.wantsBattery) {
      if (nameLower.includes('16t')) {
        score += 150
        reasons.push('Dung lượng pin Titan 8000mAh lớn nhất trong danh mục sản phẩm, sạc nhanh 45W')
        tradeOffs.push('Sử dụng màn hình LCD và chip Dimensity 6300 chỉ thích hợp chơi game nhẹ hoặc tác vụ hằng ngày')
      } else if (nameLower.includes('find x9 pro')) {
        score += 130
        reasons.push('Viên pin khủng 7500mAh kết hợp sạc nhanh 80W trên một flagship cao cấp')
        tradeOffs.push('Thân máy dày dặn và trọng lượng đầm')
      } else if (nameLower.includes('gt8 pro')) {
        score += 125
        reasons.push('Viên pin Titan 7000mAh kết hợp công nghệ sạc siêu tốc 120W')
        tradeOffs.push('Bản xách tay, màn hình 2K 144Hz tiêu thụ nhiều điện nếu bật độ sáng tối đa')
      } else if (nameLower.includes('17t pro')) {
        score += 120
        reasons.push('Pin 7000mAh kèm củ sạc nhanh 100W, thời gian nạp lại pin rất nhanh')
        tradeOffs.push('Màn hình 6.83 inch kích thước lớn')
      } else if (batteryMah >= 6000) {
        score += 70
        reasons.push(`Dung lượng pin lớn ${batteryMah}mAh`)
      } else if (batteryMah >= 5000) {
        score += 30
      } else if (batteryMah < 4500) {
        score -= 40
        tradeOffs.push(`Dung lượng pin ${p.battery} ở mức vừa phải`)
      }

      // Nếu KHÁCH VỪA HỎI PIN TRÂU VỪA CHƠI GAME:
      if (intent.wantsGaming) {
        if (nameLower.includes('gt8 pro') || nameLower.includes('17t pro')) {
          score += 60 // Tối ưu hoàn hảo cả pin lẫn game nặng
        }
        if (nameLower.includes('16t')) {
          score -= 70 // 8000mAh nhưng chip Dimensity 6300 không gánh nổi game nặng nhiều!
          tradeOffs.push('Chip Dimensity 6300 không phù hợp để cày game nặng FPS cao thường xuyên')
        }
      }
    }

    // --- E. Điện thoại gập (Foldable) ---
    if (intent.wantsFoldable) {
      if (nameLower.includes('z fold8')) {
        score += 160
        reasons.push('Thiết kế gập dạng quyển sách 7.6 inch đa nhiệm xuất sắc, chip Snapdragon 8 Elite và nền tảng One UI gập hoàn thiện')
        tradeOffs.push('Mức giá cao (46.99 triệu) và kích thước khi gập dày hơn điện thoại thông thường')
      } else if (nameLower.includes('iphone duo')) {
        score += 140
        reasons.push('Siêu phẩm gập đầu tiên của Apple với khung viền titan sang trọng, chip A20 Pro và màn hình OLED trong 7.6 inch')
        tradeOffs.push('Mức giá cao kỷ lục (64.999 triệu), là thế hệ gập đầu tiên của Apple')
      } else if (nameLower.includes('z flip6')) {
        score += 130
        reasons.push('Thiết kế gập vỏ sò nhỏ gọn bỏ túi, thời trang, FlexCam chụp ảnh linh hoạt với mức giá dễ tiếp cận hơn (21.99 triệu)')
        tradeOffs.push('Viên pin 4000mAh ở mức khiêm tốn, không phục vụ đa nhiệm màn hình lớn')
      } else {
        score -= 5000 // Không phải máy gập thì loại trừ
      }
    }

    // --- F. AI & Học tập, làm việc ---
    if (intent.wantsAI || intent.wantsWorkStudy) {
      if (nameLower.includes('s26 ultra') || nameLower.includes('s24 ultra')) {
        score += 90
        reasons.push('Bút S Pen tích hợp ghi chú tiện lợi cùng bộ công cụ Galaxy AI hỗ trợ dịch thuật, tóm tắt văn bản')
        tradeOffs.push('Kích thước máy vuông vức và mức giá cao')
      } else if (nameLower.includes('s26 5g')) {
        score += 95
        reasons.push('Kích thước 6.3 inch nhỏ gọn, tích hợp trọn vẹn các tính năng Galaxy AI phục vụ công việc và học tập hằng ngày')
        tradeOffs.push('Dung lượng pin 4300mAh ở mức vừa đủ dùng cho một ngày')
      } else if (nameLower.includes('pixel 9 pro xl')) {
        score += 95
        reasons.push('Tích hợp Gemini AI thông minh từ Google, hệ điều hành Android thuần mượt mà và cam kết cập nhật 7 năm')
        tradeOffs.push('Chip Tensor G4 tập trung vào trí tuệ nhân tạo hơn là tối ưu game nặng')
      } else if (nameLower.includes('iphone 15') || nameLower.includes('iphone 13')) {
        score += 85
        reasons.push('Hệ điều hành iOS ổn định, bền bỉ qua nhiều năm, hỗ trợ đắc lực việc học tập và ứng dụng văn phòng')
        tradeOffs.push('Màn hình tần số quét 60Hz truyền thống')
      } else if (nameLower.includes('galaxy a55')) {
        score += 85
        reasons.push('Mức giá dưới 10 triệu, màn hình Super AMOLED 120Hz đẹp, pin 5000mAh và bảo mật Knox an toàn')
        tradeOffs.push('Chip Exynos 1480 và sạc 25W ở mức cơ bản')
      }
    }

    // --- Kích thước nhỏ gọn ---
    if (intent.wantsCompact) {
      if (screenLower.includes('6.1"') || screenLower.includes('6.3"') || nameLower.includes('flip6')) {
        score += 80
        reasons.push('Kích thước nhỏ gọn, cầm nắm vừa vặn một tay dễ dàng bỏ túi')
      } else if (screenLower.includes('6.8"') || screenLower.includes('6.9"')) {
        score -= 60
        tradeOffs.push('Màn hình lớn trên 6.8 inch có thể gây bất tiện khi dùng một tay')
      }
    }

    // --- Hãng ưa thích ---
    if (intent.brandPreference) {
      if (p.brand.toLowerCase() === intent.brandPreference.toLowerCase()) {
        score += 45
        reasons.push(`Thuộc thương hiệu ${p.brand} đúng với mong muốn`)
      }
    }

    return {
      product: p,
      score,
      reasons,
      tradeOffs,
    }
  })

  // Sắp xếp điểm giảm dần
  return scoredList.sort((a, b) => b.score - a.score)
}

// 3. Tạo câu trả lời tư vấn chuẩn mực (Response Synthesizer)
export function generateAdvice(
  intent: ExtractedIntent,
  ranked: ScoredProduct[],
  allProducts: Product[]
): ChatResponse {
  // Lọc ra các sản phẩm đạt điểm cao nhất (tối thiểu điểm dương)
  const validCandidates = ranked.filter((r) => r.score > 0)
  const topCandidates = validCandidates.slice(0, 3)

  // Đảm bảo có từ 2 - 4 sản phẩm
  let selectedCandidates = topCandidates
  if (selectedCandidates.length < 2 && ranked.length >= 2) {
    selectedCandidates = ranked.slice(0, 2)
  } else if (selectedCandidates.length > 4) {
    selectedCandidates = selectedCandidates.slice(0, 4)
  }

  const selectedProducts = selectedCandidates.map((c) => c.product)
  const suggestions: string[] = []

  let reply = ''

  // =========================================================================
  // CASE 1: Chính sách trả góp / bảo hành
  // =========================================================================
  if (intent.isPolicy) {
    reply =
      `Dạ chào bạn! **MOBIX** xin thông tin chi tiết đến bạn về các chính sách bán hàng hiện hành:\n\n` +
      `1. **Trả góp 0% lãi suất**: Hỗ trợ qua thẻ tín dụng hơn 25 ngân hàng hoặc qua CCCD gắn chip (xét duyệt hồ sơ nhanh trong 5 phút).\n` +
      `2. **Chế độ bảo hành**: Bảo hành 1 đổi 1 trong 30 ngày đầu tiên đối với lỗi phần cứng từ nhà sản xuất; bảo hành tiêu chuẩn từ 12 - 24 tháng.\n` +
      `3. **Vận chuyển**: Giao hàng hỏa tốc trong 2 giờ nội thành, miễn phí vận chuyển trên toàn quốc khi thanh toán chuyển khoản.\n` +
      `4. **Ưu đãi kèm theo**: Giảm thêm 500.000đ khi mua kèm phụ kiện sạc nhanh hoặc gói bảo hiểm rơi vỡ màn hình.\n\n` +
      `Bạn đang quan tâm dòng máy cụ thể nào để mình gửi bảng dự toán trả góp chi tiết ạ?`

    suggestions.push('iPhone 18 Pro Max trả góp', 'Xiaomi 17 Ultra', 'realme GT8 Pro xách tay', 'Samsung Galaxy S26 Ultra')
    return {
      reply,
      suggestions,
      products: [allProducts[0], allProducts[6], allProducts[10]], // Gợi ý các máy tiêu biểu
    }
  }

  // =========================================================================
  // CASE 2: So sánh iPhone với Xiaomi về quay phim
  // =========================================================================
  if (
    intent.isComparison &&
    intent.wantsVideo &&
    (intent.normalized.includes('iphone') || intent.normalized.includes('apple')) &&
    (intent.normalized.includes('xiaomi') || intent.normalized.includes('mi'))
  ) {
    const ip18pm = allProducts.find((p) => p.name.includes('18 Pro Max')) || allProducts[0]
    const mi17u = allProducts.find((p) => p.name.includes('17 Ultra')) || allProducts[6]
    const ip18p = allProducts.find((p) => p.name.includes('18 Pro 256GB')) || allProducts[1]

    reply =
      `Chào bạn! Khi so sánh khả năng **quay phim giữa iPhone và Xiaomi**, định hướng tư vấn tại MOBIX phân định rõ theo nhu cầu sử dụng thực tế:\n\n` +
      `• **Về phía iPhone (${ip18pm.name} & ${ip18p.name}):** Chiếm ưu thế rõ rệt nếu bạn làm nội dung Vlog, TikTok, YouTube hoặc cần quay video đưa thẳng lên mạng xã hội. Hệ màu của iPhone chân thực, khả năng chống rung quang học ổn định cao, thuật toán xử lý ánh sáng mượt khi di chuyển góc quay và mic thu âm rất trong. Điểm hạn chế là giá thành cao và khả năng zoom xa khi quay chưa bằng ống kính tiềm vọng của Android.\n\n` +
      `• **Về phía Xiaomi (${mi17u.name}):** Lợi thế lớn ở cảm biến chính kích thước lớn 1 inch cùng hệ thống ống kính Leica và camera tele 200MP. Khi quay ngoại cảnh ban ngày hoặc cần zoom đa tiêu cự cinematic, Xiaomi cho độ chi tiết và hiệu ứng xóa phông quang học rất ấn tượng. Tuy nhiên, khi quay trực tiếp qua các ứng dụng mạng xã hội bên thứ ba, độ mượt mà và khả năng chống rung tổng thể vẫn chưa đồng đều như iPhone.\n\n` +
      `Tóm lại: Nếu ưu tiên quay video làm việc, làm nội dung sáng tạo ổn định, bạn nên cân nhắc iPhone; còn nếu thích sáng tạo góc quay tele zoom xa và hệ màu điện ảnh Leica, Xiaomi 17 Ultra là lựa chọn đáng trải nghiệm.`

    suggestions.push('iPhone 18 Pro Max giá bao nhiêu?', 'Xiaomi 17 Ultra có trả góp không?', 'Máy chuyên quay TikTok')
    return {
      reply,
      suggestions,
      products: [ip18pm, mi17u, ip18p],
    }
  }

  // =========================================================================
  // CASE 3: Chuyên quay TikTok / Video sáng tạo nội dung
  // =========================================================================
  if (intent.wantsVideo && !intent.wantsPhoto) {
    const ip18pm = allProducts.find((p) => p.name.includes('18 Pro Max'))
    const ip18p = allProducts.find((p) => p.name.includes('18 Pro 256GB'))
    const ip16pm = allProducts.find((p) => p.name.includes('16 Pro Max'))
    const ip15 = allProducts.find((p) => p.name.includes('iPhone 15 128GB'))

    const videoPicks = [ip18pm, ip18p, ip16pm, ip15].filter(Boolean) as Product[]
    const finalPicks = videoPicks.slice(0, 3)

    reply =
      `Chào bạn! Đối với nhu cầu **chuyên quay TikTok, Reels hay làm Vlog**, hệ sinh thái iPhone luôn là sự lựa chọn tối ưu hàng đầu tại MOBIX nhờ khả năng tương thích camera sâu với các ứng dụng bên thứ ba:\n\n` +
      `1. **${ip18pm?.name} (${formatVnd(ip18pm?.price || 0)}):** Trang bị camera Pro Fusion 48MP có khẩu độ tùy chỉnh, chống rung cảm biến thế hệ mới và chip Apple A20 Pro giúp xuất video 4K nhanh chóng, mượt mà.\n` +
      `   *Điểm đánh đổi:* Mức giá cao nhất phân khúc và kích thước màn hình 6.9 inch khá lớn khi cầm quay liên tục.\n\n` +
      `2. **${ip18p?.name} (${formatVnd(ip18p?.price || 0)}):** Giữ nguyên cụm camera và sức mạnh chip A20 Pro nhưng trong thân máy 6.3 inch gọn nhẹ hơn, cầm quay chống mỏi tay.\n` +
      `   *Điểm đánh đổi:* Màn hình nhỏ hơn và thời lượng pin ở mức tối ưu vừa phải.\n\n` +
      `3. **${ip16pm ? ip16pm.name : ip15?.name} (${formatVnd(ip16pm ? ip16pm.price : ip15?.price || 0)}):** Lựa chọn cân bằng tài chính rất tốt, sở hữu nút điều khiển camera và thuật toán xử lý video đã được khẳng định độ ổn định cao.\n` +
      `   *Điểm đánh đổi:* Là thế hệ trước, công suất sạc USB-C ở mức tiêu chuẩn.\n\n` +
      `Bạn dự kiến mức ngân sách khoảng bao nhiêu triệu để mình tư vấn phương án phù hợp nhất ạ?`

    suggestions.push('iPhone 18 Pro giá bao nhiêu?', 'iPhone 16 Pro Max có hàng không?', 'Chính sách trả góp 0%')
    return {
      reply,
      suggestions,
      products: finalPicks,
    }
  }

  // =========================================================================
  // CASE 4: Vừa chụp ảnh vừa quay phim (Hybrid)
  // =========================================================================
  if (intent.wantsPhoto && intent.wantsVideo) {
    const mi17u = allProducts.find((p) => p.name.includes('17 Ultra')) || allProducts[6]
    const ip18pm = allProducts.find((p) => p.name.includes('18 Pro Max')) || allProducts[0]
    const s26u = allProducts.find((p) => p.name.includes('S26 Ultra')) || allProducts[3]

    reply =
      `Chào bạn! Với nhu cầu **kết hợp cả chụp ảnh đẹp lẫn quay phim chất lượng**, bạn đang đứng trước hai trường phái thiết bị rất rõ ràng:\n\n` +
      `1. **${mi17u.name} (${formatVnd(mi17u.price)}):** Thiên về nhiếp ảnh tĩnh với cảm biến 1 inch, hệ màu Leica đậm tính nghệ thuật và camera tele 200MP zoom xa cực nét. Máy cũng quay video tốt nhưng thế mạnh vượt trội vẫn là ảnh chụp.\n` +
      `   *Điểm đánh đổi:* Cụm mô-đun camera phía sau khá to và nặng.\n\n` +
      `2. **${ip18pm.name} (${formatVnd(ip18pm.price)}):** Là chuẩn mực về độ ổn định khi quay phim, dải sáng video mượt mà, đồng thời chụp ảnh Pro Fusion 48MP rất tự nhiên và sắc nét.\n` +
      `   *Điểm đánh đổi:* Khả năng zoom quang xa chưa bằng mức 200MP của các flagship Android.\n\n` +
      `3. **${s26u.name} (${formatVnd(s26u.price)}):** Ứng viên toàn năng cân bằng giữa camera 200MP, bút S Pen và các tính năng Galaxy AI chỉnh sửa ảnh/video nhanh.\n` +
      `   *Điểm đánh đổi:* Thân máy thiết kế vuông góc nam tính, cần dùng hai tay khi thao tác.\n\n` +
      `Bạn cho mình biết thêm tầm ngân sách dự kiến hoặc bạn thường chụp phong cảnh/chân dung nhiều hơn để mình chốt máy nhé!`

    suggestions.push('Xiaomi 17 Ultra chụp ảnh thế nào?', 'iPhone 18 Pro Max quay video', 'Galaxy S26 Ultra')
    return {
      reply,
      suggestions,
      products: [mi17u, ip18pm, s26u],
    }
  }

  // =========================================================================
  // CASE 5: Chụp ảnh đẹp dưới 20 triệu (hoặc chụp ảnh theo ngân sách cụ thể)
  // =========================================================================
  if (intent.wantsPhoto && intent.maxBudget && intent.maxBudget <= 21_000_000) {
    const x100 = allProducts.find((p) => p.name.includes('X100 Pro'))
    const mi17t = allProducts.find((p) => p.name.includes('17T Pro'))
    const ip15 = allProducts.find((p) => p.name.includes('iPhone 15 128GB'))
    const reno12 = allProducts.find((p) => p.name.includes('Reno12 Pro'))

    const photoPicks = [x100, mi17t, ip15, reno12].filter(Boolean) as Product[]

    reply =
      `Dạ chào bạn! Trong **tầm giá dưới ${formatVnd(intent.maxBudget)}**, MOBIX đã lọc ra những chiếc máy có hệ thống camera chất lượng nhất trong kho dữ liệu:\n\n` +
      `1. **${x100?.name} (${formatVnd(x100?.price || 18990000)}):** Ứng viên số 1 về nhiếp ảnh trong tầm giá với cụm camera hợp tác cùng ZEISS, tích hợp chip xử lý hình ảnh Vivo V3 chuyên biệt chụp đêm và chân dung sắc sảo.\n` +
      `   *Điểm đánh đổi:* Là thế hệ trước của X300 Ultra, nhưng mức giá 18.99 triệu hiện tại cực kỳ kinh tế.\n\n` +
      `2. **${mi17t?.name} (${formatVnd(mi17t?.price || 19790000)}):** Mẫu máy đời mới trang bị chip Dimensity 9500 mạnh mẽ, camera chụp ảnh chi tiết tốt kết hợp viên pin khủng 7000mAh sạc 100W.\n` +
      `   *Điểm đánh đổi:* Máy tập trung nhiều vào hiệu năng, không có hệ màu Leica chuyên sâu như bản Ultra.\n\n` +
      `3. **${ip15?.name} (${formatVnd(ip15?.price || 19490000)}):** Camera chính 48MP với màu ảnh chân thực, khả năng chụp chân dung tự động lưu thông tin chiều sâu và độ mượt mà từ iOS.\n` +
      `   *Điểm đánh đổi:* Không có ống kính tele zoom xa riêng biệt và màn hình 60Hz.\n\n` +
      `Nếu bạn ưu tiên chụp chân dung nghệ thuật xóa phông thì Vivo X100 Pro là đáng tiền nhất, còn nếu cần sự bền bỉ ổn định thì iPhone 15 rất phù hợp.`

    suggestions.push('Vivo X100 Pro chụp đêm', 'Xiaomi 17T Pro pin bao lâu?', 'iPhone 15 giá bao nhiêu?')
    return {
      reply,
      suggestions,
      products: photoPicks.slice(0, 3),
    }
  }

  // =========================================================================
  // CASE 6: Chụp ảnh ngon nhất (không giới hạn ngân sách)
  // =========================================================================
  if (intent.wantsPhoto && !intent.maxBudget) {
    const mi17u = allProducts.find((p) => p.name.includes('17 Ultra')) || allProducts[6]
    const x300 = allProducts.find((p) => p.name.includes('X300 Ultra')) || allProducts[9]
    const oppoX9 = allProducts.find((p) => p.name.includes('Find X9 Pro')) || allProducts[8]

    reply =
      `Chào bạn! Nếu xét về **khả năng chụp ảnh hàng đầu hiện nay**, các máy trang bị cảm biến lớn và quang học chuyên sâu từ Leica, ZEISS và Hasselblad trong kho dữ liệu MOBIX đang dẫn đầu:\n\n` +
      `1. **${mi17u.name} (${formatVnd(mi17u.price)}):** Sở hữu cảm biến chính 1 inch thu sáng vượt trội, hệ thống thấu kính quang học Leica và camera tele 200MP cho chất ảnh có chiều sâu và độ chi tiết cao.\n` +
      `   *Điểm đánh đổi:* Cụm camera lồi khá lớn và trọng lượng máy đầm tay.\n\n` +
      `2. **${x300.name} (${formatVnd(x300.price)}):** Ứng viên nhiếp ảnh cao cấp hợp tác cùng ZEISS với camera 200MP, lớp phủ chống lóa T* và màn hình QHD+ 144Hz hiển thị màu chuẩn xác.\n` +
      `   *Điểm đánh đổi:* Mức giá 35.99 triệu thuộc phân khúc cao cấp.\n\n` +
      `3. **${oppoX9.name} (${formatVnd(oppoX9.price)}):** Nổi bật với camera tele 200MP tối ưu riêng cho chụp chân dung Hasselblad, tái tạo tông màu da rất tự nhiên và pin lớn 7500mAh.\n` +
      `   *Điểm đánh đổi:* Thiết kế màn hình cong 6.78 inch cần dán cường lực chuyên dụng.\n\n` +
      `Không có mẫu máy nào hoàn hảo tuyệt đối trong mọi điều kiện; nếu bạn có ngân sách cụ thể (ví dụ tầm 20 triệu hay trên 30 triệu), mình sẽ chọn mẫu tối ưu nhất cho bạn nhé!`

    suggestions.push('Xiaomi 17 Ultra giá bao nhiêu?', 'vivo X300 Ultra ZEISS', 'Máy chụp ảnh dưới 20 triệu')
    return {
      reply,
      suggestions,
      products: [mi17u, x300, oppoX9],
    }
  }

  // =========================================================================
  // CASE 7: Pin trâu + Chơi game nhiều
  // =========================================================================
  if (intent.wantsBattery && intent.wantsGaming) {
    const gt8 = allProducts.find((p) => p.name.includes('GT8 Pro'))
    const mi17t = allProducts.find((p) => p.name.includes('17T Pro'))
    const rog = allProducts.find((p) => p.name.includes('ROG Phone'))

    const gamingBattPicks = [gt8, mi17t, rog].filter(Boolean) as Product[]

    reply =
      `Chào bạn! Với nhu cầu **vừa pin trâu vừa cày game nhiều**, máy bắt buộc phải có dung lượng pin lớn từ 7000mAh trở lên kết hợp chip đồ họa đầu bảng để không bị tụt FPS khi chơi lâu:\n\n` +
      `1. **${gt8?.name} (${formatVnd(gt8?.price || 18490000)}):** Lựa chọn số 1 với chip Snapdragon 8 Elite Gen 5, màn hình 2K 144Hz, pin Titan 7000mAh và sạc siêu tốc 120W.\n` +
      `   *Điểm đánh đổi:* Đây là bản xách tay, cần chú ý thông báo ứng dụng và chính sách cập nhật phần mềm.\n\n` +
      `2. **${mi17t?.name} (${formatVnd(mi17t?.price || 19790000)}):** Trang bị Dimensity 9500 thế hệ mới, màn hình AMOLED 144Hz và pin 7000mAh hỗ trợ sạc nhanh 100W, tản nhiệt mát mẻ.\n` +
      `   *Điểm đánh đổi:* Thiết kế máy màn hình lớn 6.83 inch tương đối to bản.\n\n` +
      `3. **${rog?.name} (${formatVnd(rog?.price || 28990000)}):** Cỗ máy chuyên gaming với phím siêu âm AirTrigger gán nút bắn, màn hình 165Hz và pin 5500mAh tối ưu bypass charging (vừa cắm sạc vừa chơi không hại pin).\n` +
      `   *Điểm đánh đổi:* Mức giá cao hơn đáng kể (28.99 triệu) và thiết kế mang phong cách game thủ cá tính.\n\n` +
      `*Lưu ý:* Chiếc realme 16T dù có pin 8000mAh nhưng chip Dimensity 6300 chỉ hợp game nhẹ, không tối ưu cho cày game nặng FPS cao.`

    suggestions.push('realme GT8 Pro xách tay', 'Xiaomi 17T Pro 144Hz', 'ASUS ROG Phone 8 Pro')
    return {
      reply,
      suggestions,
      products: gamingBattPicks,
    }
  }

  // =========================================================================
  // CASE 8: Pin trâu nói chung
  // =========================================================================
  if (intent.wantsBattery && !intent.wantsGaming) {
    const r16t = allProducts.find((p) => p.name.includes('16T'))
    const oppoX9 = allProducts.find((p) => p.name.includes('Find X9 Pro'))
    const mi17t = allProducts.find((p) => p.name.includes('17T Pro'))

    const battPicks = [r16t, oppoX9, mi17t].filter(Boolean) as Product[]

    reply =
      `Chào bạn! Về nhu cầu **pin trâu dùng lâu ít phải sạc**, MOBIX xin gửi bạn các model sở hữu dung lượng pin ấn tượng nhất từ kho sản phẩm:\n\n` +
      `1. **${r16t?.name} (${formatVnd(r16t?.price || 9590000)}):** Đứng đầu phân khúc với viên pin Titan 8000mAh, cho thời gian onscreen thoải mái từ 2 - 3 ngày cho tác vụ cơ bản, sạc nhanh 45W.\n` +
      `   *Điểm đánh đổi:* Máy sử dụng tấm nền màn hình LCD và chip Dimensity 6300 tầm trung vừa đủ dùng.\n\n` +
      `2. **${oppoX9?.name} (${formatVnd(oppoX9?.price || 32490000)}):** Flagship cao cấp trang bị pin 7500mAh, sạc nhanh 80W cùng cụm camera Hasselblad đỉnh cao.\n` +
      `   *Điểm đánh đổi:* Mức giá flagship cao cấp (32.49 triệu).\n\n` +
      `3. **${mi17t?.name} (${formatVnd(mi17t?.price || 19790000)}):** Pin 7000mAh kết hợp sạc nhanh 100W và chip hiệu năng cao Dimensity 9500.\n` +
      `   *Điểm đánh đổi:* Kích thước máy 6.83 inch khá lớn.\n\n` +
      `Nếu bạn cần máy phụ pin bền giá rẻ thì realme 16T là chân ái; còn cần máy chính cấu hình cao thì Xiaomi 17T Pro rất đáng cân nhắc.`

    suggestions.push('realme 16T giá bao nhiêu?', 'Xiaomi 17T Pro pin bao lâu?', 'OPPO Find X9 Pro')
    return {
      reply,
      suggestions,
      products: battPicks,
    }
  }

  // =========================================================================
  // CASE 9: Máy chơi game tốt nhất trong tầm giá (Gaming)
  // =========================================================================
  if (intent.wantsGaming) {
    const gt8 = allProducts.find((p) => p.name.includes('GT8 Pro'))
    const poco = allProducts.find((p) => p.name.includes('Poco F6 Pro'))
    const mi17t = allProducts.find((p) => p.name.includes('17T Pro'))
    const rog = allProducts.find((p) => p.name.includes('ROG Phone'))

    const gamingPicks = [gt8, poco, mi17t, rog].filter(Boolean) as Product[]

    reply =
      `Chào bạn! Đánh giá về **hiệu năng chiến game trên giá thành (P/P)**, MOBIX xin đề xuất những cỗ máy có sức mạnh chip và màn hình tần số quét cao vượt trội:\n\n` +
      `1. **${gt8?.name} (${formatVnd(gt8?.price || 18490000)}):** Vô địch cấu hình phân khúc dưới 20 triệu với Snapdragon 8 Elite Gen 5, màn hình 2K 144Hz, RAM 16GB và pin 7000mAh sạc 120W.\n` +
      `   *Điểm đánh đổi:* Phiên bản xách tay, phần mềm cần tối ưu lại quyền thông báo.\n\n` +
      `2. **${poco?.name} (${formatVnd(poco?.price || 12490000)}):** Lựa chọn số 1 tầm giá 12 triệu với chip Snapdragon 8 Gen 2, màn hình 2K 120Hz và sạc siêu nhanh 120W đầy pin trong 19 phút.\n` +
      `   *Điểm đánh đổi:* Camera chụp ở mức cơ bản, vỏ máy ấm lên khi cày game đồ họa nặng liên tục.\n\n` +
      `3. **${mi17t?.name} (${formatVnd(mi17t?.price || 19790000)}):** Sử dụng chip Dimensity 9500 tiến trình mới, màn hình 144Hz mượt mà và pin trâu 7000mAh.\n` +
      `   *Điểm đánh đổi:* Không có các phím phụ chuyên dụng như dòng máy gaming phone thuần túy.\n\n` +
      `4. **${rog?.name} (${formatVnd(rog?.price || 28990000)}):** Cỗ máy gaming chuyên biệt với màn hình 165Hz và phím cảm ứng AirTrigger nếu ngân sách bạn dư dả hơn.\n\n` +
      `Bạn thường chơi các tựa game nào (Liên Quân, Tốc Chiến hay Genshin Impact) để mình tư vấn cấu hình chuẩn nhất?`

    suggestions.push('realme GT8 Pro chơi game mượt không?', 'Poco F6 Pro giá bao nhiêu?', 'ASUS ROG Phone 8 Pro')
    return {
      reply,
      suggestions,
      products: gamingPicks.slice(0, 3),
    }
  }

  // =========================================================================
  // CASE 10: Điện thoại màn hình gập
  // =========================================================================
  if (intent.wantsFoldable) {
    const fold8 = allProducts.find((p) => p.name.includes('Z Fold8'))
    const duo = allProducts.find((p) => p.name.includes('iPhone Duo'))
    const flip6 = allProducts.find((p) => p.name.includes('Z Flip6'))

    const foldPicks = [fold8, duo, flip6].filter(Boolean) as Product[]

    reply =
      `Chào bạn! Dòng smartphone **màn hình gập cao cấp** tại MOBIX hiện có các đại diện nổi bật ứng với hai kiểu dáng và hệ sinh thái khác nhau:\n\n` +
      `1. **${fold8?.name} (${formatVnd(fold8?.price || 46990000)}):** Mẫu gập dạng quyển sách cao cấp của Samsung với màn hình trong 7.6 inch, ngoài 5.5 inch, chip Snapdragon 8 Elite Gen 5 và hệ sinh thái Galaxy AI tối ưu đa nhiệm cửa sổ cực kỳ chín muồi.\n` +
      `   *Điểm đánh đổi:* Mức giá 46.99 triệu và nếp gấp màn hình vẫn có thể cảm nhận nhẹ khi vuốt ngang.\n\n` +
      `2. **${duo?.name} (${formatVnd(duo?.price || 64999000)}):** Thiết bị màn hình gập đột phá đầu tiên từ Apple với khung titan siêu nhẹ, chip Apple A20 Pro và trải nghiệm iOS màn hình lớn độc bản.\n` +
      `   *Điểm đánh đổi:* Mức giá rất cao (64.999 triệu), là thế hệ sản phẩm gập đầu tiên nên số lượng phụ kiện chưa phong phú.\n\n` +
      `3. **${flip6?.name} (${formatVnd(flip6?.price || 21990000)}):** Nếu bạn thích kiểu dáng gập vỏ sò nhỏ gọn thời trang, bỏ túi tiện lợi và chi phí dễ tiếp cận hơn nhiều.\n` +
      `   *Điểm đánh đổi:* Dung lượng pin 4000mAh chỉ vừa đủ cho nhu cầu trong ngày.\n\n` +
      `Bạn ưu tiên máy gập màn hình lớn để làm việc đa nhiệm hay gập nhỏ gọn thời trang bỏ túi ạ?`

    suggestions.push('Samsung Galaxy Z Fold8', 'iPhone Duo màn hình gập', 'Samsung Galaxy Z Flip6')
    return {
      reply,
      suggestions,
      products: foldPicks,
    }
  }

  // =========================================================================
  // CASE 11: Ngân sách 10 triệu (hoặc dưới 10 triệu)
  // =========================================================================
  if (intent.maxBudget && intent.maxBudget <= 11_500_000) {
    const a55 = allProducts.find((p) => p.name.includes('A55'))
    const r16t = allProducts.find((p) => p.name.includes('16T'))
    const poco = allProducts.find((p) => p.name.includes('Poco F6 Pro'))

    const budgetPicks = [a55, r16t].filter(Boolean) as Product[]

    reply =
      `Dạ chào bạn! Với **tầm tài chính khoảng 10 triệu**, MOBIX đề xuất 2 mẫu máy đáp ứng trọn vẹn ngân sách trong kho dữ liệu:\n\n` +
      `1. **${a55?.name} (${formatVnd(a55?.price || 9190000)}):** Lựa chọn an tâm, toàn diện với màn hình Super AMOLED 120Hz rực rỡ, khung kim loại cao cấp, kháng nước IP67 và bảo mật Knox Vault chính hãng.\n` +
      `   *Điểm đánh đổi:* Tốc độ sạc tối đa 25W và hiệu năng chip Exynos 1480 chỉ ở mức ổn định tác vụ hằng ngày.\n\n` +
      `2. **${r16t?.name} (${formatVnd(r16t?.price || 9590000)}):** Dành riêng cho người cần thời lượng sử dụng cực dài nhờ viên pin Titan 8000mAh, màn hình tần số quét 144Hz và sạc nhanh 45W.\n` +
      `   *Điểm đánh đổi:* Tấm nền LCD hiển thị màu không sâu bằng AMOLED và chip Dimensity 6300 chỉ chơi được game vừa phải.\n\n` +
      `*(Lưu ý thêm)*: Nếu bạn có thể nâng ngân sách lên khoảng 12.5 triệu, chiếc **${poco?.name}** sẽ là bước nhảy vọt về hiệu năng với chip Snapdragon 8 Gen 2 và sạc 120W siêu tốc.\n\n` +
      `Bạn ưu tiên pin trâu dùng nhiều ngày hay thương hiệu Samsung bền bỉ chống nước tốt hơn?`

    suggestions.push('Samsung Galaxy A55 5G', 'realme 16T pin 8000mAh', 'Xem thêm máy 15 triệu')
    return {
      reply,
      suggestions,
      products: budgetPicks,
    }
  }

  // =========================================================================
  // CASE 12: Học tập, làm việc và thỉnh thoảng chụp ảnh
  // =========================================================================
  if (intent.wantsWorkStudy) {
    const s26 = allProducts.find((p) => p.name.includes('Galaxy S26 5G 256GB'))
    const ip15 = allProducts.find((p) => p.name.includes('iPhone 15 128GB'))
    const a55 = allProducts.find((p) => p.name.includes('A55'))
    const pixel = allProducts.find((p) => p.name.includes('Pixel 9 Pro XL'))

    const studyPicks = [s26, ip15, a55, pixel].filter(Boolean) as Product[]

    reply =
      `Chào bạn! Đối với nhu cầu **học tập, làm việc văn phòng và thỉnh thoảng chụp ảnh**, tiêu chí hàng đầu là sự ổn định, thiết kế gọn gàng, tính năng hỗ trợ công việc và camera tự nhiên:\n\n` +
      `1. **${s26?.name} (${formatVnd(s26?.price || 21990000)}):** Kích thước 6.3 inch nhỏ gọn cầm nắm thoải mái, tích hợp bộ công cụ Galaxy AI giúp tóm tắt bài giảng, dịch tài liệu tức thì và camera 120Hz đa dụng.\n` +
      `   *Điểm đánh đổi:* Dung lượng pin 4300mAh ở mức tiêu chuẩn cho một ngày làm việc.\n\n` +
      `2. **${ip15?.name} (${formatVnd(ip15?.price || 19490000)}):** Vận hành ổn định tuyệt đối với các ứng dụng ghi chú, Office, FaceTime và camera 48MP cho ảnh chụp tài liệu, đời sống rất sắc nét.\n` +
      `   *Điểm đánh đổi:* Màn hình tần số quét 60Hz truyền thống.\n\n` +
      `3. **${a55?.name} (${formatVnd(a55?.price || 9190000)}):** Phương án tiết kiệm kinh tế dưới 10 triệu, màn hình lớn 6.6 inch hiển thị đẹp, pin 5000mAh học online bền bỉ cả ngày.\n` +
      `   *Điểm đánh đổi:* Hiệu năng vừa đủ dùng hằng ngày, không chuyên sâu đồ họa nặng.\n\n` +
      `Bạn mong muốn một chiếc máy nhỏ gọn hay thích màn hình rộng để đọc tài liệu dễ hơn ạ?`

    suggestions.push('Samsung Galaxy S26 5G', 'iPhone 15 128GB', 'Samsung Galaxy A55 5G')
    return {
      reply,
      suggestions,
      products: studyPicks.slice(0, 3),
    }
  }

  // =========================================================================
  // CASE 13: Điện thoại tốt nhất hiện tại (General Best)
  // =========================================================================
  if (intent.isGeneralBest) {
    const mi17u = allProducts.find((p) => p.name.includes('17 Ultra')) || allProducts[6]
    const ip18pm = allProducts.find((p) => p.name.includes('18 Pro Max')) || allProducts[0]
    const s26u = allProducts.find((p) => p.name.includes('S26 Ultra')) || allProducts[3]
    const fold8 = allProducts.find((p) => p.name.includes('Z Fold8')) || allProducts[5]

    reply =
      `Chào bạn! Trong thế giới smartphone hiện nay, không có một mẫu máy duy nhất gọi là "tốt nhất cho tất cả mọi người", mà mỗi flagship đầu bảng lại dẫn đầu ở một lĩnh vực riêng biệt:\n\n` +
      `1. **${mi17u.name} (${formatVnd(mi17u.price)}):** Đỉnh cao về **nhiếp ảnh tĩnh** với cảm biến kích thước lớn 1 inch, thấu kính Leica và camera tele 200MP.\n` +
      `   *Điểm đánh đổi:* Cụm camera to và máy đầm tay.\n\n` +
      `2. **${ip18pm.name} (${formatVnd(ip18pm.price)}):** Dẫn đầu về **quay video, hiệu năng A20 Pro và sự ổn định dài lâu** trong hệ sinh thái Apple.\n` +
      `   *Điểm đánh đổi:* Mức giá cao và khả năng zoom xa ở mức 5x.\n\n` +
      `3. **${s26u.name} (${formatVnd(s26u.price)}):** Chiếc máy **toàn diện nhất** cho công việc với bút S Pen, màn hình QHD+ Dynamic AMOLED 2X và bộ công cụ Galaxy AI mạnh mẽ.\n` +
      `   *Điểm đánh đổi:* Thiết kế góc cạnh kích thước lớn.\n\n` +
      `4. **${fold8.name} (${formatVnd(fold8.price)}):** Đỉnh cao về **đa nhiệm màn hình gập** 7.6 inch phục vụ công việc và giải trí không gian lớn.\n\n` +
      `Bạn đang ưu tiên tiêu chí nào nhất: chụp ảnh, quay video làm nội dung, chiến game hay màn hình gập, và mức ngân sách dự kiến khoảng bao nhiêu để mình tư vấn chi tiết hơn nhé!`

    suggestions.push('Xiaomi 17 Ultra Leica', 'iPhone 18 Pro Max', 'Samsung Galaxy S26 Ultra', 'Samsung Galaxy Z Fold8')
    return {
      reply,
      suggestions,
      products: [mi17u, ip18pm, s26u, fold8],
    }
  }

  // =========================================================================
  // DEFAULT CASE: Phân tích theo điểm số ranking động
  // =========================================================================
  let summaryCriteria = 'nhu cầu của bạn'
  if (intent.brandPreference) summaryCriteria = `thương hiệu ${intent.brandPreference}`
  if (intent.maxBudget) summaryCriteria = `mức ngân sách khoảng ${formatVnd(intent.maxBudget)}`

  let dynamicItemsText = ''
  selectedCandidates.forEach((cand, idx) => {
    const p = cand.product
    const whyFit = cand.reasons.length > 0 ? cand.reasons.join(', ') : `Trang bị ${p.chip}, màn hình ${p.screen}, pin ${p.battery}`
    const limitation = cand.tradeOffs.length > 0 ? cand.tradeOffs[0] : 'Giá thành tương xứng với phân khúc trang bị'

    dynamicItemsText += `${idx + 1}. **${p.name} (${formatVnd(p.price)}):** ${whyFit}.\n   *Điểm cân nhắc:* ${limitation}.\n\n`
  })

  reply =
    `Chào bạn! Dựa trên phân tích kho dữ liệu sản phẩm tại MOBIX phù hợp với ${summaryCriteria}, mình đề xuất các lựa chọn nổi bật sau:\n\n` +
    dynamicItemsText +
    `Bạn có muốn tìm hiểu sâu hơn về thông số nào của các máy trên, hoặc cần tư vấn phương án trả góp 0% không ạ?`

  selectedCandidates.forEach((c) => {
    suggestions.push(`${c.product.name} giá bao nhiêu?`)
  })
  if (suggestions.length < 3) {
    suggestions.push('Chính sách trả góp 0%', 'Tư vấn máy chụp ảnh đẹp')
  }

  return {
    reply,
    suggestions: suggestions.slice(0, 4),
    products: selectedProducts,
  }
}
