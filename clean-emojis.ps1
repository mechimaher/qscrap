# Clean Emojis from Frontend Files
# This script removes all emojis from toast messages for a professional appearance

# Customer Dashboard
$content = Get-Content "c:\Users\Maher\Desktop\QScrap\public\js\customer-dashboard.js" -Raw -Encoding UTF8

# Remove emojis from toast messages
$content = $content -replace "showToast\('🎉 ' \+ ", "showToast("
$content = $content -replace "showToast\('🔔 ", "showToast('"
$content = $content -replace "showToast\('ℹ️ ' \+ ", "showToast("
$content = $content -replace "showToast\(`⚠️ ", "showToast\(`"
$content = $content -replace "showToast\('Invoice downloaded! 📄'", "showToast('Invoice downloaded!'"
$content = $content -replace " â€" ", " - "
$content = $content -replace "Garage has responded â€" make", "Garage has responded - make"

Set-Content "c:\Users\Maher\Desktop\QScrap\public\js\customer-dashboard.js" -Value $content -Encoding UTF8

# Garage Dashboard  
$content = Get-Content "c:\Users\Maher\Desktop\QScrap\public\js\garage-dashboard.js" -Raw -Encoding UTF8

$content = $content -replace "'Bid Accepted ✓'", "'Bid Accepted'"
$content = $content -replace "showToast\(`⚠ï¸ ", "showToast\(`"
$content = $content -replace "showToast\(`💰 Payment", "showToast\(`Payment"
$content = $content -replace "showToast\('⚠️ Issue", "showToast\('Issue"
$content = $content -replace "showToast\('Invoice downloaded! 📄'", "showToast('Invoice downloaded!'"
$content = $content -replace "\`✅ Payout", "\`Payout"

Set-Content "c:\Users\Maher\Desktop\QScrap\public\js\garage-dashboard.js" -Value $content -Encoding UTF8

# Operations Dashboard
$content = Get-Content "c:\Users\Maher\Desktop\QScrap\public\js\operations-dashboard.js" -Raw -Encoding UTF8

$content = $content -replace "showToast\(data.notification \|\| '⚠️ A", "showToast\(data.notification \|\| 'A"
$content = $content -replace "showToast\('🚚 Driver", "showToast\('Driver"
$content = $content -replace "showToast\('✓ Part", "showToast\('Part"
$content = $content -replace "showToast\('⭐ ", "showToast\('"

Set-Content "c:\Users\Maher\Desktop\QScrap\public\js\operations-dashboard.js" -Value $content -Encoding UTF8

Write-Host "✅ Emoji cleanup complete! All dashboard files cleaned." -ForegroundColor Green
