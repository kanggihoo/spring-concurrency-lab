SELECT
    c.id AS concert_id,
    100 AS initial_seat_count,
    COUNT(r.id) AS reservation_count,
    c.remaining_seats,
    COUNT(r.id) + c.remaining_seats - 100 AS seat_count_inconsistency,
    COUNT(r.id) > 100 AS overbooked
FROM concert c
LEFT JOIN reservation r ON r.concert_id = c.id
WHERE c.id = 1
GROUP BY c.id, c.remaining_seats;
