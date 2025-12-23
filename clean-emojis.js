// Clean emojis from frontend files - binary safe
const fs = require('fs');

function cleanFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let changes = 0;

    // Customer dashboard specific
    if (filepath.includes('customer-dashboard.js')) {
        // Remove emoji patterns (match any non-ASCII before quote + space/concat)
        const before = content;
        content = content.replace(/showToast\('[^']{1,10} ' \+ data\.notification/g, 'showToast(data.notification');
        content = content.replace(/showToast\('[^']{1,10} A garage/g, "showToast('A garage");
        content = content.replace(/showToast\('[^']{1,10} ' \+ data\.message/g, 'showToast(data.message');
        content = content.replace(/showToast\(`[^`]{1,10} \$\{data\.message\}/g, 'showToast(`${data.message}');
        content = content.replace(/Garage has responded [^m]{1,10} make/g, 'Garage has responded - make');
        if (content !== before) changes++;
    }

    // Garage dashboard specific
    if (filepath.includes('garage-dashboard.js')) {
        const before = content;
        content = content.replace(/'Bid Accepted [^']{1,5}'/g, "'Bid Accepted'");
        content = content.replace(/showToast\(`[^`]{1,10} Payment/g, "showToast(`Payment");
        content = content.replace(/showToast\(`[^`]{1,10} \$\{pendingDisputes/g, "showToast(`${pendingDisputes");
        content = content.replace(/showToast\('[^']{1,10} Issue/g, "showToast('Issue");
        content = content.replace(/`[^`]{1,10} Payout/g, "`Payout");
        if (content !== before) changes++;
    }

    // Operations dashboard specific  
    if (filepath.includes('operations-dashboard.js')) {
        const before = content;
        content = content.replace(/showToast\(data\.notification \|\| '[^']{1,10} A payment/g, "showToast(data.notification || 'A payment");
        content = content.replace(/showToast\('[^']{1,10} Driver/g, "showToast('Driver");
        content = content.replace(/showToast\('[^']{1,10} Part/g, "showToast('Part");
        content = content.replace(/<p style="font-weight: 500;">[^<]{1,10} /g, '<p style="font-weight: 500;">');
        if (content !== before) changes++;
    }

    // Common: Remove document emoji  
    content = content.replace(/Invoice downloaded! [^\)']{1,5}'/g, "Invoice downloaded!'");

    if (content !== fs.readFileSync(filepath, 'utf8')) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✓ Cleaned: ${filepath

            .split('\\').pop()} (${changes} changes)`);
        return true;
    }
    return false;
}

try {
    const files = [
        'c:\\Users\\Maher\\Desktop\\QScrap\\public\\js\\customer-dashboard.js',
        'c:\\Users\\Maher\\Desktop\\QScrap\\public\\js\\garage-dashboard.js',
        'c:\\Users\\Maher\\Desktop\\QScrap\\public\\js\\operations-dashboard.js'
    ];

    let total = 0;
    files.forEach(f => {
        if (cleanFile(f)) total++;
    });

    console.log(`\n✅ Cleanup complete! ${total} files updated.`);
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
