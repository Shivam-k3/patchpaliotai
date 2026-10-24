def test_even():
    from mathlib import is_even
    assert is_even(2) is True
    assert is_even(3) is False  # this will fail with buggy code
def test_odd_also():
    from mathlib import is_even
    assert is_even(4) is True
