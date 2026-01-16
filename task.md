# Task Checklist - Single Family Edition

## 1. Core Architecture Simplification (Current)
- [ ] Remove multi-family isolation logic (Assume single global kitchen context)
- [ ] Implement "Role Switch" (Chef vs Foodie) in Profile for testing
- [ ] Ensure "Order" button in Kitchen creates an order

## 2. Dynamic Interactive Module ("动态")
- [ ] Create `pages/dynamic/index`
- [ ] Implement "Order Status Card" (Pending -> Cooking -> Ready -> Eaten)
- [ ] Implement "Chef Controls" (Accept Order, Call for Dinner)
- [ ] Implement "Foodie Controls" (Urge Order, Rainbow Fart/Praise, Rating)

## 3. Profile & Stats ("我的")
- [ ] **Public Area**:
    - [ ] "Foodie Weekly Report" (Stats: count, fav dishes)
    - [ ] "Wishing Well" (Submit new dish requests)
- [ ] **Chef Zone**:
    - [ ] Kitchen Settings (Name, Bg)
    - [ ] Received Praise History

## 4. Kitchen Page Logic ("厨房")
- [x] Menu Display & Management
- [x] Cart Popup
- [ ] **Submit Order Button**: Integrate with new Order System (Create Order record)

## 5. Global Navigation
- [ ] Update TabBar: [Kitchen, Dynamic, Profile] (Remove Discover options)
