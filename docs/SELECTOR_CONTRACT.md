# Selector contract halaman Allys

JavaScript pada paket final ini menggunakan HTML Modul Allys awal (yang sudah ada di `pages/`). Jika nanti menukar markup dengan versi Stitch yang ditempel di percakapan, pertahankan ID berikut atau sesuaikan JS terkait.

## Hasil (`pages/hasil.html`)

`pageAlert`, `emptyState`, `resultContent`, `calculationPeriod`, `resultDate`, `totalEmission`, `transportEmission`, `electricityEmission`, `transportPercentage`, `electricityPercentage`, `transportSectionTotal`, `electricitySectionTotal`, `transportDetails`, `electricityDetails`, `emissionChart`, `legendTransport`, `legendElectricity`, `dominantSummary`, `recommendationLink`, `recommendationBottomLink`.

## Riwayat (`pages/riwayat.html`)

`pageAlert`, `totalCalculations`, `averageEmission`, `emissionTrend`, `trendCaption`, `lowestEmission`, `lowestDate`, `historyCountLabel`, `historySearch`, `periodFilter`, `yearFilter`, `historyTableBody`, `paginationInfo`, `pageNumber`, `previousPage`, `nextPage`, `exportCsv`, `historyTrendChart`, `detailType`, `selectedCalculationDetail`.

## Rekomendasi (`pages/rekomendasi.html`)

`pageAlert`, `recommendationPeriod`, `emptyState`, `recommendationContent`, `dominantTitle`, `dominantDescription`, `transportBar`, `electricityBar`, `transportShare`, `electricityShare`, `totalEmission`, `calculationLabel`, `ruleExplanation`, `transportRecommendations`, `electricityRecommendations`, `generalRecommendationSection`, `generalRecommendations`, `backToResult`.

`common.js` juga mengandalkan `currentUserName`, `currentUserAvatar`, dan tombol dengan atribut `data-logout`.
