import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractIntent, scoreAndRankProducts, generateAdvice } from './src/advisor.ts'
import type { Product } from './src/index.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Hàm đọc và bóc tách 24 sản phẩm thực tế từ seed.sql
function loadProductsFromSeed(): Product[] {
  const seedPath = path.join(__dirname, 'seed.sql')
  const content = fs.readFileSync(seedPath, 'utf-8')

  const products: Product[] = []
  // Regex bóc tách các khối VALUES (...)
  const blockRegex = /\(\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(NULL|\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([\d.]+),\s*'([^']*)',\s*'([^']*)'\s*\)/g

  let match: RegExpExecArray | null
  let id = 1
  while ((match = blockRegex.exec(content)) !== null) {
    products.push({
      id: id++,
      name: match[1],
      brand: match[2],
      price: parseInt(match[3], 10),
      original_price: match[4] === 'NULL' ? null : parseInt(match[4], 10),
      image: match[5],
      chip: match[6],
      screen: match[7],
      ram_rom: match[8],
      battery: match[9],
      rating: parseFloat(match[10]),
      tag: match[11],
      description: match[12],
    })
  }

  return products
}

const testQuestions = [
  'Con máy chụp ảnh ngon nhất?',
  'iPhone với Xiaomi máy nào quay phim tốt hơn?',
  'Tao cần máy chuyên quay TikTok.',
  'Tao cần máy chụp ảnh đẹp dưới 20 triệu.',
  'Máy chơi game tốt nhất trong tầm giá?',
  'Tao cần pin trâu, chơi game nhiều.',
  'Máy gập nào đáng mua?',
  'Tao có 10 triệu, nên mua máy nào?',
  'Tao muốn điện thoại dùng học tập, làm việc và thỉnh thoảng chụp ảnh.',
  'Điện thoại tốt nhất hiện tại là máy nào?',
]

function runAllTests() {
  const products = loadProductsFromSeed()
  console.log(`\n======================================================`)
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ HỆ THỐNG TƯ VẤN BIX (MOBIX AI)`)
  console.log(`📊 Số lượng sản phẩm thực tế trong Database: ${products.length}`)
  console.log(`======================================================\n`)

  if (products.length !== 24) {
    console.error(`❌ Cảnh báo: Dataset phải có đúng 24 sản phẩm! Hiện có: ${products.length}`)
    process.exit(1)
  }

  const results: any[] = []

  testQuestions.forEach((q, idx) => {
    console.log(`------------------------------------------------------`)
    console.log(`Test Case #${idx + 1}: "${q}"`)
    console.log(`------------------------------------------------------`)

    // 1. Phân tích ý định
    const intent = extractIntent(q)
    console.log(`[1] Phân tích ý định (Intent):`, {
      wantsPhoto: intent.wantsPhoto,
      wantsVideo: intent.wantsVideo,
      wantsGaming: intent.wantsGaming,
      wantsBattery: intent.wantsBattery,
      wantsFoldable: intent.wantsFoldable,
      wantsWorkStudy: intent.wantsWorkStudy,
      isComparison: intent.isComparison,
      isGeneralBest: intent.isGeneralBest,
      maxBudget: intent.maxBudget,
      targetBudget: intent.targetBudget,
    })

    // 2. Chấm điểm & Xếp hạng
    const ranked = scoreAndRankProducts(products, intent)

    // 3. Tạo phản hồi
    const response = generateAdvice(intent, ranked, products)

    console.log(`[2] Top sản phẩm đề xuất (products array: ${response.products.length} máy):`)
    response.products.forEach((p, pIdx) => {
      console.log(`    ${pIdx + 1}. [ID ${p.id}] ${p.name} - ${p.brand} - ${(p.price / 1e6).toFixed(2)}tr - Chip: ${p.chip} - Pin: ${p.battery}`)
    })

    console.log(`[3] Nội dung trả lời (reply snippet):`)
    const replyLines = response.reply.split('\n')
    console.log(`    "${replyLines[0]}"`)
    if (replyLines.length > 2) {
      console.log(`    "${replyLines[2]}"`)
    }

    console.log(`[4] Suggestions:`, response.suggestions)

    // --- CÁC ĐIỀU KIỆN KIỂM ĐỊNH (ASSERTIONS) ---
    // A. Số lượng sản phẩm phải từ 2 - 4
    if (response.products.length < 2 || response.products.length > 4) {
      throw new Error(`Test #${idx + 1} Thất bại: Số lượng sản phẩm trả về (${response.products.length}) phải từ 2 đến 4!`)
    }

    // B. Sản phẩm đề xuất phải tồn tại 100% trong database
    for (const p of response.products) {
      const exists = products.find((dbP) => dbP.id === p.id && dbP.name === p.name && dbP.price === p.price)
      if (!exists) {
        throw new Error(`Test #${idx + 1} Thất bại: Sản phẩm "${p.name}" không tồn tại hoặc sai giá trong database!`)
      }
    }

    // C. Kiểm tra ràng buộc ngân sách cụ thể
    if (intent.maxBudget) {
      for (const p of response.products) {
        if (p.price > intent.maxBudget * 1.05) {
          throw new Error(`Test #${idx + 1} Thất bại: Sản phẩm "${p.name}" có giá ${p.price} vượt quá ngân sách ${intent.maxBudget}!`)
        }
      }
    }

    // D. Kiểm tra logic từng câu hỏi đặc thù
    if (idx === 0) {
      // "Con máy chụp ảnh ngon nhất?" -> Phải có Xiaomi 17 Ultra hoặc vivo X300 Ultra
      const hasMi17U = response.products.some((p) => p.name.includes('17 Ultra'))
      const hasX300 = response.products.some((p) => p.name.includes('X300 Ultra'))
      if (!hasMi17U && !hasX300) {
        throw new Error(`Test #1 Thất bại: Cần có Xiaomi 17 Ultra hoặc vivo X300 Ultra trong top chụp ảnh!`)
      }
    } else if (idx === 1) {
      // "iPhone với Xiaomi máy nào quay phim tốt hơn?" -> Phải có iPhone 18 Pro Max và Xiaomi 17 Ultra
      const hasIPhone = response.products.some((p) => p.brand === 'Apple')
      const hasXiaomi = response.products.some((p) => p.brand === 'Xiaomi')
      if (!hasIPhone || !hasXiaomi) {
        throw new Error(`Test #2 Thất bại: So sánh quay phim cần có cả iPhone và Xiaomi!`)
      }
    } else if (idx === 2) {
      // "Tao cần máy chuyên quay TikTok" -> Ưu tiên iPhone
      const appleCount = response.products.filter((p) => p.brand === 'Apple').length
      if (appleCount < 2) {
        throw new Error(`Test #3 Thất bại: Quay TikTok cần ưu tiên hệ sinh thái iPhone!`)
      }
    } else if (idx === 3) {
      // "Tao cần máy chụp ảnh đẹp dưới 20 triệu" -> Giá <= 20M, có Vivo X100 Pro hoặc Xiaomi 17T Pro / iPhone 15
      const hasX100 = response.products.some((p) => p.name.includes('X100 Pro'))
      if (!hasX100) {
        throw new Error(`Test #4 Thất bại: Chụp ảnh đẹp dưới 20tr phải có Vivo X100 Pro ZEISS!`)
      }
    } else if (idx === 4) {
      // "Máy chơi game tốt nhất trong tầm giá?" -> realme GT8 Pro hoặc Poco F6 Pro
      const hasGT8 = response.products.some((p) => p.name.includes('GT8 Pro'))
      const hasPoco = response.products.some((p) => p.name.includes('Poco F6 Pro'))
      if (!hasGT8 && !hasPoco) {
        throw new Error(`Test #5 Thất bại: Chơi game tốt trong tầm giá cần có GT8 Pro hoặc Poco F6 Pro!`)
      }
    } else if (idx === 5) {
      // "Tao cần pin trâu, chơi game nhiều." -> realme GT8 Pro hoặc Xiaomi 17T Pro (pin 7000mAh)
      const has7000 = response.products.some((p) => p.battery.includes('7000') || p.name.includes('GT8 Pro') || p.name.includes('17T Pro'))
      if (!has7000) {
        throw new Error(`Test #6 Thất bại: Pin trâu chơi game nhiều cần máy pin lớn và chip mạnh!`)
      }
    } else if (idx === 6) {
      // "Máy gập nào đáng mua?" -> Phải có Z Fold8 và iPhone Duo
      const hasFold = response.products.some((p) => p.name.includes('Z Fold8') || p.name.includes('Duo'))
      if (!hasFold) {
        throw new Error(`Test #7 Thất bại: Cần có máy màn hình gập!`)
      }
    } else if (idx === 7) {
      // "Tao có 10 triệu, nên mua máy nào?" -> Phải có Galaxy A55 hoặc realme 16T
      const hasA55 = response.products.some((p) => p.name.includes('A55'))
      const has16T = response.products.some((p) => p.name.includes('16T'))
      if (!hasA55 && !has16T) {
        throw new Error(`Test #8 Thất bại: Tầm giá 10 triệu cần có Galaxy A55 hoặc realme 16T!`)
      }
    } else if (idx === 8) {
      // "Tao muốn điện thoại dùng học tập, làm việc và thỉnh thoảng chụp ảnh."
      const hasWorkPick = response.products.some((p) => p.name.includes('Galaxy S26') || p.name.includes('iPhone 15') || p.name.includes('A55'))
      if (!hasWorkPick) {
        throw new Error(`Test #9 Thất bại: Học tập, làm việc cần đề xuất máy cân bằng ổn định!`)
      }
    } else if (idx === 9) {
      // "Điện thoại tốt nhất hiện tại là máy nào?" -> Phải có flagship đại diện các phân khúc
      if (response.products.length < 3) {
        throw new Error(`Test #10 Thất bại: Cần đề xuất nhóm flagship tiêu biểu đại diện!`)
      }
    }

    console.log(`✅ Test Case #${idx + 1} PASSED!\n`)
    results.push({
      question: q,
      passed: true,
      topProducts: response.products.map((p) => p.name),
    })
  })

  console.log(`======================================================`)
  console.log(`🎉 TẤT CẢ ${testQuestions.length}/10 TEST CASES ĐÃ ĐẠT CHUẨN 100%!`)
  console.log(`======================================================`)
}

runAllTests()
