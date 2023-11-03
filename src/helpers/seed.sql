insert into
  `keys` (
    `active`,
    `created`,
    `tier`,
    `key`,
    `name`,
    `owner`,
    `updated`
  )
values
  (
    DEFAULT,
    DEFAULT,
    DEFAULT,
    '123456789',
    'API key for free users',
    'test',
    DEFAULT
  ),
  (
    DEFAULT,
    DEFAULT,
    1,
    '987654321',
    'API key for pro users',
    'test1',
    DEFAULT
  );
