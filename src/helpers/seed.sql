insert into
  `keys` (
    `active`,
    `created`,
    `level`,
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
    'test API key',
    'test',
    DEFAULT
  ),
  (
    DEFAULT,
    DEFAULT,
    'integrator',
    '987654321',
    'API key Integrator Role',
    'test1',
    DEFAULT
  );
