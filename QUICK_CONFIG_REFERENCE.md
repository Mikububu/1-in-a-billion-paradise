# Quick Config Reference

## Change PDF Font Size
📁 `src/config/pdfConfig.ts` line 33
```typescript
body: 8.5,  // ALL PDFs updated
```

## Change PDF Header
📁 `src/config/pdfConfig.ts` lines 63-69
```typescript
header: {
  show: true,               // Hide header? Set to false
  showPersonNames: true,    // Remove person names? Set to false
  showSystemName: true,     // Remove system name? Set to false
  separator: ' • ',         // Change separator to ' | ' or ' - '
}
```

## Add New System
📁 `src/config/systemConfig.ts` lines 20-60
```typescript
new_system: {
  slug: 'new_system',
  displayName: 'New System Name',
  shortName: 'Short',
  description: 'Description here',
}
```

## Change Person1/Person2 Logic
📁 `src/config/docTypeResolver.ts` lines 50-90
(Modify the `resolve()` method)

## See Full Docs
📁 `docs/CENTRALIZATION_GUIDE.md`
