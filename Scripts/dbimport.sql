CREATE TABLE `company_profile` (
  `id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(255) DEFAULT 'Maniq Ceylon',
  `logo_url` varchar(255) DEFAULT 'assets/img/Main Logo.webp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company_profile`
--

INSERT INTO `company_profile` (`id`, `name`, `logo_url`) VALUES
(1, 'Maniq Ceylon', '/uploads/company_logo_1771829621026.webp');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `company_profile`
--
ALTER TABLE `company_profile`
  ADD PRIMARY KEY (`id`);
COMMIT;


CREATE TABLE `gems` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `weight` decimal(10,2) DEFAULT NULL,
  `dimensions` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `media` longtext DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `image_url` longtext DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Available',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `gems`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `status` (`status`);

  ALTER TABLE `gems`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=164;

  ALTER TABLE `gems`
  ADD CONSTRAINT `gems_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL;
COMMIT;


CREATE TABLE `local_orders` (
  `id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `item_id` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `weight` decimal(10,2) DEFAULT 0.00,
  `dimensions` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Available',
  `media` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`media`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


ALTER TABLE `local_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_id` (`order_id`);


  ALTER TABLE `local_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;
COMMIT;


CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `gem_id` int(11) NOT NULL,
  `buyer_name` varchar(100) NOT NULL,
  `buyer_email` varchar(100) DEFAULT NULL,
  `sale_price` decimal(10,2) NOT NULL,
  `sale_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `gem_id` (`gem_id`);


ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`gem_id`) REFERENCES `gems` (`id`);
COMMIT;


CREATE TABLE `whatsapp_messages` (
  `id` int(11) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `message_text` text NOT NULL,
  `msg_type` enum('incoming','outgoing') NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `phone` (`phone`);

ALTER TABLE `whatsapp_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;
COMMIT;


CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `image_url` longtext DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;
COMMIT;

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `image_url` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `created_at`, `image_url`) VALUES
(0, 'admin', '$2a$10$jieO6n4wbrNRlnnfYLyfpeiJp8.WgkYCagQ6ex726TXEwFlZSQAYC', '2026-02-13 13:26:13', NULL)