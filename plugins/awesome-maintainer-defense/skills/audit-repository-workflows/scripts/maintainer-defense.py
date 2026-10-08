#!/usr/bin/env python3
"""Audit repositories and preview, install, verify, or remove the Maintainer Defense Kit."""

from __future__ import annotations

import argparse
import base64
import difflib
import gzip
import hashlib
import io
import json
import os
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
KIT_VERSION = "1.1.1"
AUDITOR_VERSION = "1.1.1"
RULE_HELP_BASE = (
    "https://github.com/thangldw/awesome-maintainer-defense/"
    f"blob/v{AUDITOR_VERSION}/docs/AUDITOR_RULES.md"
)
MANIFEST = ".maintainer-defense-kit.json"
PROFILES = ("observe", "balanced", "hardened")
LANGUAGES = ("en", "vi", "ja")
EMBEDDED_FILES: dict[str, str] = {
    'auditor-rules.json': 'H4sIAAAAAAAC/+1aTXMbNxK951egtIe9cMRE/lzvSbYU27VxpJLsuFJbWypwBiSxmgEmAIa01uX/vq8bmA/KFEVaPCRVPsSxhzOYRvfr168b8/kHIQ58PleVvFoo57U1By/ETyO67JpSefzr3/iHEJ/5T1zWBa4dvDvJXp/9lv34408Ho/aXoEOp6McLVVuvg3U3wqu8cTrciNqWOr8R2otKe6/NrH+uUFPZlOHKK5iAe2mJShW6qYb3+NzpOkQD+Q0uwGBRyRtRaJ+X1iuxaEqjnJzoUgetvKibCd5a3gjrhJxIU1gjHD/qxXKujDBW+KbmtQpRO72QQQlnG/wJSwubN5Uy+O2wt8TLqbpyigyUrTnHRSEuT199uHj7/vfDqhBLHeaDhZNn/UjI/iVsBvwQXzfCBV/jHiXUp1rlgdemJ0yBp5bSGbrX2CCC7TcM9zoV+o0O7Jyrsr6SJp9bxw4tspldrAasknWNVfsgc6APpk5WamndNT13VitzefmzuMytU7l0xcGoxcBlim12zrGlHxpX0i/zEGr/YjyewQ/N5DC31dh6Px37dpHxpLSTcSW1GcPJfgwE5tcervtbC5gsAubgSzLsP/z/L6ONYDxaA8ZXZyenZx9/Pb24FBPbmEK6vaIw4Ty3JjhbZnUpjRJTjdQRuTRiokQ+l2amIigQakSUQozN6SDsEnj1c113tm2BNKdkmZ4UUyCbQjUt7RJowaYaJYKqYEdQuBDm6nYORkwN3KKDV+WU74VpBkvmKq6PVy20WmKFWjosiExC2jglABxnAWVc2wJyR3uD3CtbqOyCjdoP3HJaMO7y4MvoGyx66WjD2bmzAVlLUdqLXZO4bN0vu1MiPNqcCIUFPIlLWiCWhGDgXhxGWx+UFsdi4qwsBuCmUtKmw1LJa2XuyIeEty5RV+DNuHV9zskm2IozY4ukkcKDVvVU52KcNjm+baGRFZEsGVTqmZ6UoGUJ7y/adCADyA3TGySLDENjuFp22UNpp1E4TKGKtKkt8uTRXyRPdkHi4zVIvAyuyUPj4JtIWHBatTUpAwp3Qu+D8f3abaUn4NmK0YV8KhrOJ4G9FMogVhRUbVBHJQoq7T3gPwQ7gN5mgK31YSt8GWsymMPvJ8j8fvzul+H+nPqjwc9c8oeG+KBqMHUs+zB7ouZyoa0bJbyXaiFNGIoIuswa5Su9E8XFVjrg8XqwbRXUJ2uC+k7mc/gNIJGFROqIQtWEfwPV19QFaZ4dNeCmQJ9rQxxyzC6MzFDL/BoBi/FGhBBFAfe2PoJFrQs77ZfsqhTVaO0r0omJgnIZ0QFjUdunekaQugcHr9obxQnvXU5AsVjyQhnLoo/ojKih542/+1jOFWB2AyRULcuxEa3fmrJs4eOBDyxDRrsZXLhFpJ/sjVZOupBmH9i07L215X4YpodLFredBVp7J7J5ugaXL29X0hWBLSRcSZWw1/qitLksy5vN4MQz6k50vutYhNFI68MVNb1rTWXgiFM4VV/4uIOge9UntDlGlsNa0wJym9p3kvbV80t8KXgk+n4kuGRldePn1ISA9vLUe0xuaul9qpKRdxTbSTkNh+aqANiTcEx1EfWygbVeBWI6HzdCnJBZA5VxfP4Wt+TK+y2A+3RvwP2zqbSPP9/ROn9MYkfMJSk0NHt1hgKgSvwNsqkDyAMF2rShEin+ayfMltrM6dmo21j2t1jL0vLi9dv3bz68vHp/9q/TX0WtHDM4JRCEkOkQvUWhHDz7Qnz+IiCjWoUn4k4JZzNHNY8hQ8SnqZ4P34q/k/UJe2h1AmdLt9IOJLmc7rUrfk9xys57W/cDNQ5/NnDBhnbl1cfTgRT8eJodPf3HGivypTqELHLq0LrZGJQrx4i2NprTf4yHDuehKnfC9NEmTHNQQQmAmspAsQnTw01thPVcz+YbQE0U6yD0fCcMqPjiakWIIpw3UHgNhAPxD7MsWUJ9BNBADXKworIF0ZhXBglAMm6o8ZW3DbjS3wPzC4X2G9qh3yizIPUVVY3XtDnFhGpAz9RbR7BHygeJErpT5kcrh+hvU+J+XB99x/VecL2uoX6tw5tm0kJNx466jsIUSJJgWYSe8AdqvXxz/EDOrprAKjbIGeE61h6GdYXWnd44TABq2PoWOxV96rrbZIxjqXuR7G25UEm0piWoJaFead0eaY5Jyic9kW6Exbgk+T5okVErFmDtQhnsQ6VBZ+zoB++KUtDfD/T99c6xtcg6rYvGaj9Qj9DIiuHCO4D9+dE3gB0P7Q72dT37OVpLXSoaZAK0qM1xX4LhFQJ6L+UybaZlQ21TxN+D2Bz1+5rn9u3iacRa9haw8EhvjIBXn1TekMhNcIMs+RQi+06AxGx1ehRZ/54UuEyzT2iJIMm/kGamKKmNnyLZhu8lGuDurTFxIKwnALSLtzC9Q7xBuFA/d5X6udsCeUjztBadUMQh//058Hh/jR5xg7ONz9rivacmr1u35aE/ZwasG3B8QEAbH8FVNyGNGSQ4uD2FoWHlqqLYnAEAfNDoNe/OgjXYJ/BkLXgY4SkVoDkaryesmMkq2ASWCVqWPs41Ok3P1M+Tzi1z4EJxiWn3SbjkjfqYAsT1TeedWoY5nURYOoIY5kG2miqjNLWhDpOQv5ClJrJHGXBBT6GB2O4u7VBu6p6EfKBZz/058eR7TuwpJ9YNV17RLqgE0DFsTeM1T2ojCt9c1lGwkMR7oPghLPVaPsr6TutMGl0WPEdNSRnPMmRrEZWjLhkYddQI6ODFN9WD0K6bDVLshZjiT8qDEs0Fr0a/5AxoKEXSh61sT11rmyJ8lGBrFec5sXQZ6Rw3xBKv6WBPTcH9kH/6F9T8O+Dw2UZujtKACQMep7mEq9nNRNusWD3cVrZQeohEuVOYsOggJMqSUEv0OFOGu7wivR7YRTdcxRYwihZApxsMJutoA/z4atzXjlbgyZlJ/WONTpUcyxKdznQX2lnDY8CFdJqzEjnE3AtoSj/sEGTqZ6jIJaT+0dgQm4BofbdIO9D2UPp5t7v7IfpsN4h+xXrPnu9Oes+e7855zzcr4a6ZSiEkP67U57aSPVQHdG+6StrS09SAMdaip5UC8WSJWPFmWJRXVQP1hnNsQsxtWZASuFvC3IO739LYl0u58xEl7bYJWb0NFJFRlCKRsQG9qB/SDXG6AuR5XcSF6q99/U9hyHXdvum2wi5NSaPLXjvcj8Hn35XBw5XBu7OTOybZJ4Oj0AqAa6sbHZITdxQP6w652HLx5uN5t3ooQgeMQV7Hjw74U6kRHetcM/wKkBWAA1jh4eqWSGWcdYOTeVOxoLh1gL9WF+AZqG4wbjx3ju0c7XzUFv6V5UZQttLTFH51L+mghb/o8jw0BDjpiJB0dTvXZhdS3qYPDojaNyIedtw95d4qxusmu29Z/QT+vm4Oj5OOAv984jPehqTZNEam867T/vqhUrCPm1FL5FMiwgnNSA2aiP+l9+o11qH1cWAHvM2DcomdnIrqAIHjStZMkB4sGbcZkJ1oHzUukxXtnCs6epkmfeXHdKz5iP5mJJD1NZ2Y0UnuqD0QJy1b6n4MtuKw+FkggGFIV4Ibg5LFFrE+ekCsH22fz+mcir5IJNHNzhgA9qEzz/5FtzI+RpyizyMTaaj28bn+wHse5i0U29cf78ZPJxDuNhupnOr2Pdsep3KZi/skoBhVjtKCfFy6/ntOuor486ecfH7qvzpWLRKgyHlbRPnRxij/QPz95Yf/A3YWpwHmKwAA',
    'docs/PLAYBOOK.md': 'H4sIAAAAAAAC/21WS4/bNhC+61cMsFfZQN9A9xQkLVq0BYokvYeWRhJhimT5WK/31/eboWRvkh4WC0vUaOZ7jR7oL2N9wR8nGnlin5miM9dTCOeue3igb470MVkzc9f9nThzemIqC1NIdrbeOPrn/Z89JX6y2Qbf0yWk8+TChVLFr2JXzsWssSfjR8rG22JfeCScH9kPfKQPHE0yhSnzUJMt10NGFziGFyWOIZVMUworxXpydiBp94zn3jqTs52u2o1dVx6tVEk2n38mUwr7goYIvYSxp+qzmfjeXTRl6WlIPMo5jMHPMeSauAcMuaQ6aAOmlrCaopOFRHN44uQN+qbZxCO9C+RDQUsT4MPZJaS82ChH0SYqt85zuToUtvquctVSZhhCxYHF5hLS9ahgf3uk90CGL133NvjJplWnm6wfrZ/JzCAqF71mWoOTdazQClRADaVoCHj3cwFECw9nuiyMBxImLNK8AzMORJYsfcxg5EUHpBgAb2tOaLYYcpAm5pragWExfuZMJkacNCfrMMyRfg3pM5xKMngUs6WaC6i2Plb0HMiCSX4Gy1ot7IihCGXrzzL7ENJIk3GiwtBEkHW86iG+4J5QbxtPGEMbtrgNvO+O9KYVfIFY30AcsydD3kAaFC5QuBA21FV4EQhjCnjJVjEFJzL+t1pogiKn1WZRNFAaTTG4Ndho8Sgu6Hl7wszpILo/gQOeJh7kJj8PHBteGI3hnV4QYwE+1MLNLHyRstxswc9gE3edO5kBOPxm5+Vg1yhXt97y3tsrog86lBRP4cm4R9QCpKPck3YDPOHHRp3NKtQN8EZ4Q+17wI4XE1rrug/FpEIXWxZyYUDHWk57FMA+hZMGwCeBTpSHZ6uXjiQZ4EuVZIF/8mb3NQKaU0C9yZl5BrKNzP3XDUlB+khIGHGS5woRNbxU96rvjRrESakZYoS2M4kh92SApWo2W6lfvBFaBgeGe5nm3NOp/RvZ8c3SpxTMqG5NYilg5ewqSg3eXWkSldLKRqJhRGOMLFF8lroav1MpDeIXFGl3K/8gcs4xCHRBblo/aADcpXm/RhuTOBxNzeKegZPEMt7g8HbJW1rDyJsV735T0Fos75mqDQI6oBuvgt895rLUick+aVRu6Yrhw46hCzPA+x1WkxN3E998q/INZ26BKRTeiyPiPIRoR43zmiMcQVCUnYxaQ2FCeFx1LxxOCMBRzIZ3Aej1pnUkF8RbPUJGCjXC96FEU4h9mWvB4shZ/YyxRpuFbbkh0RAg3JGBIeopIz9uShePbZIaRD5d985mFYto/LYh1ERr2NbdTX6qO6r6mnZDMgs37vb9KAsJOW2cA6mruQLH7XdTVfWg0k4WT4mLwIAqID/SF9d3z0NqVfygahNhhcgQKs9IyFUwkq57sbgsRKNR9NpdWEuyBnzLCvBvWg618XiFDgwWR5LNZ9UFon/KGHasbkspQNXWrSmfKapB2VQqaxVXNKZkr4lfsXf3iP7pSH8wRw2qMbSUbAB23Rb+DdPbLpPikmS29Ls8mln6uysxEthbe6wt1wbf4qn/nxxX0WHYHpv3nrL39IZ+a/PYBVs3XPq2jg77OqJTHWcut0xvHxJfRfquBm0eF/bB5znxLIzdzYrdrNtO98gjje2bQv2Yl9cc7h8QltXGyVxuVtad6MtRvxvavrj5xe/fChtu+MpKYpmvepbgfiVkynjeCbelJi8p1uK/oSNhdOz+A7JiGaBACgAA',
    'docs/ja/PLAYBOOK.md': 'H4sIAAAAAAAC/2VVW08qSRB+51d04vtJ9vYL9mmTTTbZZLOvhwOtThwZM4yafaNnQLm53kFEDyKoI4ocjrsevCA/pulh5l9sVQ0ori8w09PVVfVdqmeYdOrSuZXOmnTy0nkKDr6qZ1gpS+da2k3plKTjSLsTiczMsO8+wPasdFrSPoW90u5FIirjSHHD/vj9V5kSJl/RkpqRgMdVw1yY1Y1VZi7jq1exVfYRHy5rqrPmORl10pX2TlBpSpGWoua7T17hBFaGg2PVPpCiLMWzFBWZsqX9KO22dM4wMxRqNyBWbeel6KjMdVAqqM3y8BFCCtLOqexaUD2dDvduXS+9qfJVqNO7y/qpMpShNrpB5UGKFpsUCosxk8d5wtKiOvOeNqXIYmkpMTr5RzXyo8M0iy5bxmLUCjucM1a4mYgmYpwNexvKrsD5UlxKu0iV7KgMxF+Ncvfq5hDrgaTdz17qQtppr7Q+7O+GBQ/7R34qg4tQZPUWAr2/3XEItlCV9i50QQR8jwRcS2eXwHiKRLxcyj/HZN5RTuXvoR/p7Eu7TtRdSeESZMfAVEgcJPbTVFbmQm1lp2FSzVLguECXzpPcwrb/TY/u97zSfbB+DK++26aqrqQNcQ0pzgNxOdpz1WbHd/rYlyiqZk7am9AUFoK0FkanD35rYzrPnxNhSAEhHTh5OKgHJ0/0uhEGqswZ8UWE3tT8enFk39MJNQjx3MugskWvAOaOP+j73+rTKQirHz4wLzeA5IBSIaP6u8xYTXCTIVjdB2kLarGrsneoyvDIlJDOOil7EFBdyCEs2rfkEZL+BHzYg7+iB7SrfjeoDbCV5wLgiCfvf/HbX0Z7t6OrAkA19gZfZfGoxTFhuwHQoP5MQ9c/RWMLWJjvHgTFr29YCU+GFM0QnvS4ZuBBdJjJl4ykZhnmX5PuQOPUNbIxyPjnAkGCeqoNr/aIXze3vHrWX2+RADuTzUSFAKvl34nuxw9MdffBZpGIdNrU+RWIa3Kiyz4an5LcXOEf2ZJpzGo6Z2PmLgoI86SV4WPDr7tgI1Ip2PgeEYWm68XQZ7N6dA5C98lBNWnbZCh3stLCU1F4k08wK3p10KfnVryj6/dKG/bagH6YEGBetrQEnu+ypBW1lpMsNs9D2FW6RWZ9Df1ZN5JIk27EFuDv0/g/znVO9GkJi5vRGE4CpmuLmsVCKXu9azLJuIeQAfQGSOPhAYuesi/uP6qRlIuEfUHBpEFXnkixPewPyELTmv4J/I/OhinxjZRKohSuer70yheRyC+JmIYT7FXqKvcVOFXINYoQBhXJroCQvE4zMkX7NDRFksMctCiYpiuSbn8BwYErqa3DN7M6477B/L2Xyb846g/3xpP5zaTFPM0uDS/8Mipt4wjBI2HempY2CzDjplG6DptUsfTmahDH6I3n4pSN6BjwFzXdYprFFynJ2gY2E34dw34pRR7hyd7hK0jxokEXUjlEKzj+HFQbmLt6QzIKW8Wuxk4F2G4Kb0eP2nqx6A2Lxo0lAtjkMcOMs7FtiR6so3yGF1dKjI2D6GtzCUBlVUvE6U6ahQfQbRIfo3qSMzK8tsJxJbq0xGERnqx5kyfnDT3O4jw2uYNfMLFMbW6OMk5NIQJl62raor+N6/rfrGoeIeM9UNpgGufQky/dQlvhHMAuPbjsp2H5D/FBtq1pCAAA',
    'docs/vi/PLAYBOOK.md': 'H4sIAAAAAAAC/11VTYvcRhS8z6944KsYyNclvsWnEAeM83F2T6tXakbqVlrdszu5hRBM8MFZggnGmOxmMUu8WXZNDCEjwh607P/QP0m9bml27MOMZjSt9+pV1au5Qw8qsV5Yu6TFsDmxtBq6x1QLbTxeys1md+7QB3P62mlRqNns/s1loG8e3s/IqZVutTUZ7Vu33KvsPrmAb17XqvWibmjVH3HRN6YgWQ7dn7heH/YnVNlhc6wpH7oLqjT6BTIlbq1JAkKNZv2xLKlVMjjt1+jUWOdpiRpPNTVhUWlJDHCp5vSg7P8wU0k3dKd4t+TdzeXQvZBUD5sL/ykBns0zCqYVe2oLOKNq6J6TdCpXxmtRZZQDuwvS65UiEbythceMVKL+P5IKu1LOCCMVFaKZ0xdl/xZTtWFNOQb5yZAHdCo05qBSrKn/DyMP3RNTkh+6M8oFf+rP8c7sNKVlcnjceWT6wzk9BK9qfza7/mXoDjWYQ7GrQHva5BqHoc8LjW+VQmWBGwzt2Mc2z/l3lJXWeHXgQWd3KiJ9gAp8P9YgBjdCpVrlM2osmFwzsmdJITkNip89d1v0rw2ZwvZHQNL/TZ6H4lbPNImmweNioSsWaRmpmNO3Ed8uw5tT0FIqC/ZBbetVDvGaECFvrlD+Bsp5tH8jcdETBLBfWtY/MfNRlPo15WENx/jZ7B6e+HnLrt2HWe9Sged5emehZaNcrdvk0diEXXZudo2XJcG25EXwsYBeQH2XkTqQqvGxBgZW7BEXFYKWXkW60axaCLkEh1HZA5Sc070E490GUlg2ORhhVRJquOB2rrvx6A90EIbNK59MI0KugWWkGMfhLj3x8300aOLoY7gHWGwAPZ+x8SPFp2HawspKUaVyyX7ORiM9sotWuZV6BNRpET3WID7Me8pMmajkqzUv1FmIi0raqxqluydYL5GcN0Lc3pzTzUVAJLCNHHCxp2ACft8uAcLChxbkKbmMACArAJ/Dv5VtVcawlxkt0iVXlQLvo0mQAsoJGXe00rXmlEhONWVEieGvDy1enAcnMqMy1MJMEnJ7dt5LuA6zjjR+MqfPjdScCUlfJXnv1+97Tk+HoowZ++oMk+3EhixvLgWv1uZCpgt4TDnrsVPm/Xg0OI/LyCKDFhyDTkUgFkwUY/6BqP4tS3Le7OyVOkBmJrNiQrtU72TbCk+UKW+F83oPvMX58v5fxjD6Na35Dif0lWAScXsyegYXdL9zd9gjugDnTxpO08c8X/cU7ZGjOgmDZzfsPrAmk+S8phjK2bZRKWu3I3MW4eRvGlp8yddbYHFvRG7jOkZVXE7F0P1aTwqYoj9aZ5OvM2p1YeD4fWQnZ9GYoS0+iapVyL9Wc/d22m18+A57uLnyt7FdYpTSVvj32O45JisKLG4yxzYM8Mc1hvUIZzcoRsNua8R/wrhmvuz/QlsE64o3f9zF+ex/r03VmpsHAAA=',
    'kits/balanced/.github/workflows/pr-quality.yml': 'H4sIAAAAAAAC/41WbW8bNwz+7l9BOAP6pXLdIO4yAy2WdNkL1iydk2IYiiLQSbw7JjrpqpckHvbjR53Pjl+HBg7s00ORjyjy4VnZ4BQ+zuBrkobiHCoZcTBwdjoAaJMxtx6/JgwxPwPEeYthCp9dixb1S/C4/IWaYv4Oc6tq7yz9g18GgyOYodTCWbPwPIKbmgI8On9fGvcIFh/Qg6pR3QdwKYLzgE+oUsTQhRd9eFBO42jQom8oBHI2ZELK2Yg2MiPPYXiBsYTPj+selquDO1d0m6MnWeHiXD7ZwCynkIpkYxKGuYbYQSFiGxZWAAJsl7D3mTGEVPRsVukLVFlpQm/OhPS0D7RaSiEzbFHeuxBeSRtJBOPaHyffn05OkSmenP6gx6fF8WRSyuJYlicTORm/UcdKvkFegCN4GK+8PVKsp6snYPCantaYiSWzRZJH8LNLHkpJJnnOsfQIOUHkUUN0UBpZgeSCGK35bOSTWO6YwskaUhin7lGLwE4VisJLvv1sNBxu7Ve1tBVblmQyPhkfwA3ZjL8e89+aSc9RNJJs5H/0QkkrGqepnOcUJ9xjrTEoT22kfLVbNl1Q1zQURYMh8A0Jg7bibDK5faFL4psVFh8zxR13yriAovVTzq0J60hO0V6AC71po9BelpENwo7P3qBwuXj/XQMApMqHCoKLyW8CKbqS+Gj0mfd92cA0crNqyeu7mEfrHrjqd5GKKywVoo+4jfccM4/ta+8hZlQ7L2QITpFc3MXVX39czF5eXlye89f7qw8fzs6vZmc3V7Pd7UYWaPZ7bv3/oZJ7v8nVFl1XUgfSn83Y0TdYrpscoHPQ5Ah+oiALg6wIrFjckK9YCKPzc6gxef5JirvRatabOVu13j0R9ydZiDVCIQPmshttuPwdse3VBUqn+A40sBYFxaKctZmd6KSooCwALzvvvOgCLeLOK8JNlxojqihCK5vuRrPY7clHQ5bLQTmWSpElFLabWbNYzEXJKh82wWUvtakwpDhjLuvB/gg9mJu0NUyMk7rlLVvlA3ED+6wdXQ8dNhA+V9+uRWVcwZ190GZJuleLvp4bGVW9h3k+/rPsrDRlO0XYuDsSXQ53wTzsmHiJ3JUKtw611NxWxnqf0kqtGc1kF6NxvDW7LqVfH12BC0xGnsRcPHVqpOXzPhA+Po+wcroYgqNFqY14TrcphhFPg2QivH0LL/J0QP1itYfn6aZioaodDP/cnJLcOIrD5snDNc7DvKQqdYOoZt+1M3o0hHfvYPjdL7/d/Prp/Pb65uLj7fWny8uz2d/DHe/dqwV/rIs8wu6SrnIGgPWOXywWtxZqavM7BnXvDd/q/YkivB78B4WkulYrCQAA',
    'kits/maintainer-defense-kit/locales/en/adoption-record.md': 'H4sIAAAAAAAC/0VSy27cMAy8+ysI7CUFNvmA3ooGPfWFpB+wtMRdE5FFg5K93Xx9R3LSHAQQnuGQM/SBfrDmiidOUc6SixBHW6paJpdgHofhnp5ksaLV/EacIwWbZ62fAfy6orMVX96bIldpH367nTUJ3Z1sLOKbnI50GjlxDhJbPbFHyag/NfqzXjInumqOdu1DCs8L+mepk8VG+QZM86XQeCNfAZlT6W0d5YTd+5q6SekSa3YpljbBylyk9EWXRUBt5kQb0oi2VnjaCX8mNE2WIgIJWpqnRuEVe7i+cnPZDYrPWhq+D5O/Vbx5QALc5HVRybVrfrVcXccVCd5v0ByxvZzPEnb4yVIaObwQSJcLTrHrcaiE9zbvJwZAdlO5voU8HA70+L4jAMQZZBi+a35BehlBvMKf43Zey5GqFAisGWX33E5HvCxuG6cHejTKVklzSGsUCi7Qq4qsjrS4bhj5oYXow4cn0k6tt917nRg6BfFnhFwK47c5g1Un+Z/pw/APt8jdIHwCAAA=',
    'kits/maintainer-defense-kit/locales/en/bug.yml': 'H4sIAAAAAAAC/61UTY8TMQy991dYnIdKwG1uC0JiD4gVe0QcPInbWs0kwXGG9t/jmX5t22UrxJ4ykzzbz3nPidhTCx/rEoRyEp15Kk44K6fYwvdpD3A8lOSr4y4QeFqQ0/lMWYMFv/lh4T9tnXXJb9sZwFvQbbaTHmXt0+9oWwCoKtxVpdJO/wADhmqoh0BYCAqhuBXQhotyPPApgNHbd5+GEeKEbCsJZJKSIgbwqAgdLZLYee161jF6/oQFx1x1Ksm+hcECrbe/UArYUWjhbjF2SP6AHiu61FvyPS4HdLRKwZNYynfz9/MPJww8frmb7Rtk42cJjgWEflUWMiIqlZ6wVNooCuGRKMWBJcWeor5M9vMFEOBMw2+PDUiNyj01kNGtcUmmTLRFGhjvnNWarWLHu7sONGBUy5Ipeopue7iGMv//tg5O0psifOXIvSl8FXHR4IOkgT2BrswBFhCoqIlh0piARSmXZjJTYU2ybXY6Gb5gn8MYhnqsQWVKYz9m9P4V2kW7WQw33DZhzMQrHDjJcz3eRxeqcTaDGWclIJEk0ySEtLQhWSjJbkzG2dkPyivwp02eJuGGBfeo8x7+pbBbkVt3aUPlWNqluGDp8bZTPl0iAVI+qzsW2oPvT2J7E5vtEqO9cKXm8b05zfz8GPoM7auc1jZBTGqvzaSUB1PAhkcZg/lP05piaa5erheK/AGOruW9mgUAAA==',
    'kits/maintainer-defense-kit/locales/en/config.yml.tmpl': 'H4sIAAAAAAAC/zWOuw6DMAwAd77CP1CyZ+/QiQq6dEIOuCXCJCh2qBDi34v6GE86nc4xhrH1IpmkpYCOqbfwQBYquhgUO23Zh1FsAXCCgBNZaKjLyesKS+ZACZ3ngw4BICe2MKjOYo15eh2yK7s4mW2rz9equdyq+r7vRn4Fg/3iJSZPYgK9Pgl0MauFmuaYFP4mfB9hTn5BJV7L4g2UO1xKvAAAAA==',
    'kits/maintainer-defense-kit/locales/en/pull_request_template.md': 'H4sIAAAAAAAC/0VSy27cMAy8+ysI7HWz/5BDgRyCIEgL9FAECC1xY2Jl0aUou83Xh5J3sQdDBh/DmSEPB3isNonyF0UoQRYahmfOF7CJgEupBKIwI2fzjxSU/lYqBpi93tCoV45Sc3QEqRZkptMwHA7wY+VIOTjiq0r79+ZFJdZgLNm7aSlHMEfzp+HRPwwGKymfOWAvcrTZU+UEP/uwmpWKpNVnJZ7ZelXZ572Szk65BXa485mClSbICW+il3OSDZZ72dFHGmnGBBENoeU9GCSb8lhN9GHlwmMiwE76SrSQGedPCBPmT3Jyv5Wd3EeWTB+wTaTesCzJVXjvzu5NUhoxXIbhBefdNdmao3flSq7dmuGRC96n7gBP1Z0AvK6rCx+GB/gD7/AIU0+2JahvxQ3rsBgCLVb6sFJH98vcuJ316dbrMmdscXRTWnMgmLDASJQbJaatJR3OWYUkpZf2Q2CleMN5EbclKNmxOVzkZuqx6VmU17a+tSaXjCMntv8QyY8q+ZkB55BqvIP9akfhe3A/OvmdcnROE64su2l6dRQWtOk0fAOrSg3DzAIAAA==',
    'kits/maintainer-defense-kit/locales/ja/adoption-record.md': 'H4sIAAAAAAAC/0VS3W4SQRS+36eYhGtfoHfGxLtGgz4ACzvAxGVnM7tAesfsim5FjBGlEkhLW6iU/mAlJrZBeZjDDstVX8Ezi43JzmbOnO873/nLkF2TOT4eKohFi9TxKIm/f4ib42TydfP+h2E8Ilnqco/5XOwRkBNS4JUK83fQ8ayONH3ZMtTBWBvPBS8ym94vohzPe1TUaA4aMpc3bdMpUCs1yqawqIPG/WJfc16wkmPapM4ci9e1ipr01OBSdW/V/IsGZKs2xfc/II9Azoi3xYP8jFiQ16SITOaUPI19atpYRZozq1EvDTeYJt9O1c3dZthc96816rHrUgRq7/rnR3U40I8vy4J6ZW5b2IwC8xh3Uvb+Mpm2k0YzLY+KCvO0K+XGo+4mnED4FsIFBMtNQ66Wx3Ez0lAI5hDiF0E4hbAD4XgL0n95kZy1QEYQtOJ3t//ks9y282bhFfEFK5VwJFr86nR9cgdyqjrt1e8Upi6P4/4hEbTGaJ1Ypk93DCOTIXE0Ut0rbEcyWajW0DDU+VE8e6PCZjy8geDTpjcC+RpbiFSXCx8n4VPPJ6Lq4JXraZJtrQhOc55DMAN5kDa+B43giaA4N5+ZNhJcwWqo/T/Yg/7F6lc7OZOYMy6Lg7Xkq7g9hKVUf09nbGJps+2KPcTvQ9BBCeMv8WYMlpQCAAA=',
    'kits/maintainer-defense-kit/locales/ja/bug.yml': 'H4sIAAAAAAAC/7VUTVPaQBi+8ysyvdeZtjdu7am3Hjx2egjJtmYMSRo2Vm/srlgQGdQOVasWRKZaWkXGdnQQ8ce8LB//ortL8Kso03F6Irx5s8/7fOzr6HEU1YAtAz3ipTpfWYyYKGH4loct14lqfCHXzbd4vtZj50Cq7dMcT53w5TTQ1UE7kDUgLSAbkKQRbGFbHPfo9Yvg3RvxG4m55lw0ommPNTzniTdx3Z823Q+OKGmajrFvxQKMElH1X9NmdDsQXZ21Mj9YB3IYQtDVTmWr+6sssZKknyTtix2eyQH5AfQEWBNoDdhPYAyYGGyeJ7PtRgPYR/XqQo6aWexvVNSo34DkgZSAFIDMy5mvhrMcL8BqEsuMajPITwgJ7pjU1mPIFvKc1/tFhZAXZ68AzUopJewpsD1gx0qbIpAa0GNgxcGM4RmerRtoyrVN5Au4JxNPJ55pI/snXz6PhPJYpi6NuZzDR+8Dy0diXuwH6BoZjGax7iP9kg9yZizfdeLIwfdz6q4e8TILazfC8GpSyA/su+Qlda0AK6nKipyT1ofEvwLLDZ935YPooWVVOQC2oOwi8pUw83O5n9yV8aHZdmtb2C4q7QsqzL+tpPLqgSL4yPNdMzDwWGc7W0l+lB/Ev5PJ9ksLoxThhXx/Z0n6rxoHPAafCgaD75RCVWDbikpaPovKDZ+bwDLtVlacI/q7hapIdrfSuCuvD9RAN3Cg22NyfVjsf9mUFJY2eLYwivqoq3f9ohX54RJP7YulAXRfhaZ5RZodiH0j7/XJWfts/T8RRbMeMjAyxxld5K1U6NwV239BNqaQMR1zZ1HiEttwnbeWH9fHB61bbvSqubDmejcQJUTYBvS3jJCMSprXWr36zl+bZm8YwsFGlh4MdbyDwC0MMUdvv9lhKbF3VWrTQ4fF7SMj1uqyWMBEWTevIDeBfroX8g9HekvqbwYAAA==',
    'kits/maintainer-defense-kit/locales/ja/config.yml.tmpl': 'H4sIAAAAAAAC/23NsU4CMRjA8f2eoi8g3bs7MGHQhenSOyo0lJ65r4UQQkJ7wIAmRBN00kCMkhgcbsa3+VLjvQXEmf2f3z9RXPdiCWAFxELzRIk2I7dcgYjSTBuemlhJ3QMWEXJBNO8LRtAf0H9j8YHFFxYL9O9/s0X4KX+nu1NFiM0VI11j7oBR2pGma5NamvXpeNy8vGpc128azdZkQkGkNpdmRHl7ICHLpQCqxfCf4ElmzblTWK+q7QP6p+r1Lcz31fM9ul3YlOFxie4F3Se6FboNujW6GU59dASWUo104gAAAA==',
    'kits/maintainer-defense-kit/locales/ja/pull_request_template.md': 'H4sIAAAAAAAC/3VSTW/aQBC9+1esxLk/oseeemilHqpKMWabWjF2ahui3FgbIRDQoqKEUFBDG0odaIIgqAfCx48ZdjH/orML+ZCiHLzWzs68efPeJBJElJZxvwrsBIIKsPP1MM9bY0175XkZSoAtMAZsSNK6afv4UZe49HOGej6B4BuEfQhvIBgCa0CObZo1fv39HksUa+JHG9Pi6CyelWSOxGtCLtC0RILE0UyUO5rGC9X114UolTedAqL4CI4/cXWx/jUF1hfdNmYSw0mndTsl2667021D0e7Hfy7ECK/XvPhvPcnjqzj7gg2fdBPRJfIDFvH5aHO+1LR3jnvw0XKOyCF106bnmY6NkLx7ugkjktJ9nchXDEFwI6cMi2rcOoS/IZxBsJQnG8S9MrAiBGVRr67mbcz3qO+b9j4xPun2PpWEebEhKs3HlOLLMZ/XVaQPLM87E14rSqH3VKCxh9pHz+gG4ZVsHQ4grEEYovya9vpIWoM197KhT1nq+o88TJmenrQo2RF91pfVFOsHEKih1Hpo2gvynnwg8fjv6vZWalxhwLoqscK7JdGaSFtqBXRDwfXu1moL3ZAMEH2L8jLjO2ndpymio+qer9uGUgl572py7NCxTOMYyQ/4AmVC1N7mtLwz/inkG2q4VG4Neuk5tm4pA+XdNbPYimQzFgqkJ03L9I9JiuIuW8qZ2gDYUiG2IKg/IL5VK343HS+fSMlYRFzHspK6caCKh4t49FNqpWZGHx+E/A8w2BH1WwMAAA==',
    'kits/maintainer-defense-kit/locales/vi/adoption-record.md': 'H4sIAAAAAAAC/1WSwW7TQBCG736KkXIBKfQBeoMDQgJBKTxA1vbUO8p6191dJ+TMoQdOiBMHRKIIVRQqioSEZB96MMp77JswuyYiPdheef+Zf+abmcCT0H8At9uAtxT6txrmUhDUgrTnBy2UeIbaYZY9gFNsjCNv7AoWwxoKU9fkj/nixZKV8fC8GtarO6ni3xNrzkgh3JuZ3KFd4GwKs1wooQss41kKW6Lm8/0of0WVFgqWpEuzHJ2GTSFBhe7LCurQfWuj7DHfk64ceIkGbMsG0oTudwEuJUgaoRxCqpoW6FIyb3c3of+kK5Ch3zZQyN2NgIpCtyU4b1ehu01NPWwa5HD4837Ygpahu9Ypfh4FLGR9lL0cI1gW+ndacjUWnTSqTGJdJTOCRg5XULK2v0jZT9DW5BwZPValdxvau5Sh/wGKGV60kA9XmrOYYZ1QvmYSyeoj16/l8F2zYeKSh/4z8Uw0089bHlKUnxqlclHM40iqiqeZAEhhwMdEhRyuueQ3fP4/PYsLwiV4BnLbJLjHWTaZwKPQ/WTTgql95e/53b6z7BnFUkc6ljfF+hGd4qFwb4dNxT43KygYYT0Fj44j2pHuIScW9JcCTNyuI3gqh1/sW0nu0iLviyehptBYWgiPe8t/K3Dotp9MKfh1AIj3M2XkMi4jxtiwP8r+ArLlX0QUAwAA',
    'kits/maintainer-defense-kit/locales/vi/bug.yml': 'H4sIAAAAAAAC/61UwW4TMRC95ytGnEMk4JYb7aUXJCQQQkIcHO8QW7trb712SI6oBw4cIKcKIURDVBUQFS2thLR74OCo/7F/wnizDSmEFEQv693Zsd/Me/OsWIpd2PATDUlV7spWhDk3MrNSqybOwyOtytd2nkKBE7CiKnfA+okEIavyueq0rLQJnXXt0YbrP6a11dPRqNsCuA52lNGflJk40k8VhQCYtUb2nMW8W38DDFjiKOuBk5D4r6pPp39OobcoYY5Tow/8Hgz9CYMcuUELQlfFNw5RVX6BJKS5sAWU8O8VWHN2VJVvOMRCQr8qD2VnqSipMmfrCmTUhQGanDr/Q4UJ62HShbtC+k8KelUxVefQXKeptBQrX0CICxAB9Z3qN3uzhHEUOonQEMyNzs3OrV/23tu63Wp4kBELAiyADW47aZAKtMbhUvUWh5YZZIsGUA2k0SpFZdc3ccefyoaat4siL4i/RTzCbEx0PnMg/J4SbTBOWZliGzLGY9ZH0lTRYtoQy6r4Hsj2Ba/1yZZZijBDFaHiI9InhLcdU53/b9dgZnTkuL1UtE0/4WJ5YMFW5ZgoCF87bhUBm46GkFfFfhamiUOvmSMrUNcG+BjOOG6HKnQurTajc0lnY1onClI/pSmsypfhWezb1d6Z++oK6GDcOpasJ2IrKAkDWZdxTN2Qbqu6n73yh5QY+w9p4/umt0T3qb+qOBiFpTyAnLnaW0uOvIJecJghtxj9ZTepVnVZ5VT+MzYXyOOeHmK+QOdaPZEmZZcP1sMwGkHdQ9X80NkF2IDT5N4PppuNaSh+Uz84h3xxwTWcrkFKD2M35UBy7VIWvXcWJ69oahVkLPxpTc/ZEQPSh5xoJUvaYHWMav31SV7WP2/hNdA/AHbgVvFLBgAA',
    'kits/maintainer-defense-kit/locales/vi/config.yml.tmpl': 'H4sIAAAAAAAC/02NsUoDQRRF+/2K+wNm+ikFC0GIRBurZWYy2R129o3uexORkMJPsBDrENIIgvVuGfE/5k+MVjb3NIdzbTTU1YE5e649GRv9UmNlIvvKJRLjpI6BOtYVcAYyvde4KtMb2jK9UgNbxn1CX8YPORlAHqJGK3LPWqkmSJvtzKVebTaLi+v5zeXtfHG33Sr2Lg9BnpRZrgOnIXhW5B//EsamLBrnx12C+511GQ+Er5cyPf//w0M26I7v1GIIJzSQ789Z9QM81+a30wAAAA==',
    'kits/maintainer-defense-kit/locales/vi/pull_request_template.md': 'H4sIAAAAAAAC/1WTQW/TMBiG7/4Vn9Rr6X8ADhwYaEK7IaQ5rqk/JbGDY7fkzIEDpx04IIToVKGKikmbBkJLDhw87X/4n/A5abvu0KZxnfd73+d1RiM4VrE9L2GOcHt2dxm7lYBKhQ1MfRO7j46xIwwbDXls/znAuvYSlIntXwFN2HgQsV2n727NoeSoHX2khXlYgk7/D8+987FdgQjXMMPYfUVIQ/WEsdEInsT2Ss9AqNj91DPGnvp0F9sfFVhZWTP1wqHRY3Cydr1wQca0gvfhXECJ9EuocLFdmMDLNNaGPw9G0Za7S56W2hWSnSbZGuYfS1tSLhpR9+ouyd6exe5LcnOEiQLkRGRhbP62MAuo9k+MYcodh341S5j0zIQlklfFzaCkVfil6Z4CNZDF7juCMNpZzLwzAyja3PQTPyPU0jnUswk8UwinuQq/E41wfQqaLPvUzQ1F6lbV4P6VKYqMi5yxPrdZ7OjfO7ByLq3btTbFmmeFfMBs4HDQ+rZQMkqJ0qn4how9gtfwBl4QGLdf7Wv75MFZ0lEUNuEqIV0++N6HUH2Vmi4X+jDqZCv4mDiU3MkpcGJaO66FpC1hdX8gKQHKRS9H9kVham8laUkDlSlQNDut53teBFJY6caprNpoXgxNpfGCyDrsz+XcF8SLZ1iga6CyOCcjO7GTdN4yolhRxjWosCRe9J4c1pUs2W0FE/YfNNAppk8DAAA=',
    'kits/maintainer-defense-kit/profiles/observe/.github/workflows/pr-quality.yml': 'H4sIAAAAAAAC/41VTY8TORC951eUmOs4ZEcTdugTsMte+JhVFokDQqjark6bcduNy56ZRvz4LSedkE9EpCjdfs9Vz+WqF48dVfDvAr5ldDYNEGqmeI/JBj+ZBF9NAPrs3JdI3zJxKu8AaeiJK/gUevJkLiHS5omMTeWXB6/bGLz9Tp8nkwtYEBoVvNtLMIUPrWV4CPGuceEBPN1TBN2SvmMIOUGIQI+kcyIuGnUwNJ30FDvLLPu5qNHBJ/JJ5ETJIQuCZfr5WtSrUf1mdfJVVJTNazG0PlXMnkVjBbnOPmXlUPKmFcSJel6zABT4VdUWpEM0wLke9WyLyHbp0TFYD6klkGzC6jqMwxgCIHPR2BPeBean6JNV7EL/Yv7nzfyGROT1zXMzu6mv5vMG6ytsruc4nz3TVxqfkSzABdzPttEebGqr7RsI+J993FGmNsrWxZ3CPyFHaNC6HKW2GAlKiWwkAylA43AJKCWf7sTs8FFtdlRwvYPULug7MoolqCZVR5TLL6QnTw726xb9UpiNdQWfz87gzvqC/zGTzw5l1Kg6tD7Jl6LS6FUXjG2GClLMdIJtiHW0fem4I84qaeg6m1RHzLgk5cgvpZoi7lTqxsrNKk8PReJROO0Ck+pjJbV1vIuUEp0EpMG7PikTsUlC4KOYI6EOpX1/7AAAqMuhWEkzxX0gp9BYOZr9JPs+72GGZFYNyvoxFskHmU06RpbSYblWY8ZDfNRYdBxe+wiJojZEhcxBW1zfxe3H968Xl+9ev3slP3/dvn378tXt4uWH28Xxdoc1udOR+/grFGX6u9JtKaxa6kz5C00C/QZzl3JGzlnKBfxtGWtHYI14lgzkUzHAFOIALeUoj1bLNHoxlTQIq4/h0dLWR2pkKm033Qv5hqjfdVVogpaLMCCPrMWYiz9LJJO1rW1xgctVClkMbNfJh6Wl/biGEumkuMduda3F8k4UpbNeekIHMUwlw1PB4UQbcYxBNWLxvA9uBqrPtbNayhaKKZzOMIJlUnsnwqSyB9EKqxxIpjgWA1kN0nmCiqVUx4ylC7WM91nORvRoGWNTd5h0e0J5Of5P79kay2GJqAtfrVrV8Bgs/3kivCEZTU0Hh9oYb4+pPWW3aIygRez6H3I2+R8yVjsi8AcAAA==',
    'kits/workflow-hardening/.github/workflows/dependency-review.yml': 'H4sIAAAAAAAC/0VPO27DMAzddQoCnZX6k6i1pg45QS5Q6EPFKhzaNSUHuX1lu0g2ku9LMjfUcMYJySO5B8y4RLwLMZIWAFMehu8ZfzNy0kJMON8icxyJV9SNlJAS66IyXoif0W733WOdypyJZTGDbDOlLAeTitcGccKJdxaABNqqXDYt+Fcj1xu6Iv/zADJjSTQurTXeX0S5x8od+TK1bz4b2yqrQnuqO2Pq0AanWhVU1bnjh/feNt0R3mA5HapD9Qy4x9Tr5wYQTBzKC5JxwTmmh4Y+XnvxB3SBTF47AQAA',
    'kits/workflow-hardening/.github/workflows/zizmor.yml': 'H4sIAAAAAAAC/7VSy27bMBC86ysW6c2AHpQSyNQpRg7JPwRBwce6YiORCh827KL/XtKMHSNIjr0Q3F1yZnZ2NZtxgEflnwKHjfDKaAcORbDKH4BpNh2cckVh9FAALGGaflp8C+h8imOG+dHlK0AJN9Uv5cfA672xr9vJ7F29Wt18lFermp1IqsM8fZ1nubAEN2ZcbpkWI7oBnmem9Mv/5C0WtLNyLtkwwJ+/RfHb8BPPUR1nYzOjDdqV0REIPGgfyon5aEjWdfX/nUYY7VH7iGeRyVPSeVyu1OvTEB5GFK9ggo/vFuOUN/YA+9hWSkXcOAePEoRFGeEUm9w7AEBwyZ7ciatFAoqf7qloKOG8JbwXRBBJaApps5ZrirdIpZRb7LCBH7Drq6ZqLoCJdrhEcKYvr8gH2MYTPzWxSRtzRLjM4ZPGbKMwFut8LbPqe0JbbInsKeMtpeuu7xpGOkm6dQzvRNs1/ZYLxpLWprqr+m+1MrmLC4OyPK/xWek/y5qAvuwCAAA=',
    'maintainer-defense-config.schema.json': 'H4sIAAAAAAAC/5VSTXPaMBS88ytcDQfc2hbQXsolF6a9lKGn9hAcRsHPtjL+qiSXMuD/3ifLJlJCJ1MGjLza3bdPT+eJ55GpPORQMrLySK5UI1eUPsm6Cg0c1SKjiWCposv5ch4ulnTgB72YJ7Yw4ypvH6NDXVKVsyorkiNlR5B1CWHJeKXwByJMIIVKAn0NhYe6SnkWDcV1EFNIcVWALrW5ary10XhG0wqm+JV+anp2/fgEB2UwliRcM1jxXdQNCMVBIidlhYSeIOBXywXoju6JSbD/DUL2rh6RbdMIkPpVkrhXNLbRGRHEXggRJxhQKlwtumDg2Faj0orNhGAnEowwV1DavNsNDjtvtTnQnGZFW8AeRxlonEnTb33EQ9YL+NMgU+4Rju1C1WmbavkV8rBXxzflVQaiETgyEnfBv4kNUzkyrgS7zo1DHnsYYuszHg9EKqyW6djoqUDoCZCHzTqcfd3+uPz8ctls1354Pw8/x+eP3ZQ4qZzAb7tqFxam8Xn56ZVT35Gb1xrb6Ofulrz6BlXWCxcv9uy6s7t31MdH9H52t3q4UH+3i/CLL/Qy9c3ODj9+9GFKLBs34TDp2206UVyduRf/LbNu0W1tWouS6WMnCVNAni/DuDL/+tlNuslfYTCVA70EAAA=',
    'policies/AI_CONTRIBUTIONS.ja.md': 'H4sIAAAAAAAC/21TzW7aQBC++ylW6pPk2ENvVe8usRJLgKkxldITu+Y3QEwCaUtDBGpISB2EmzRViQnJw4zXmLfo7NpQWlUCyTs7Mzvfz7wgOy9J2PVC5x7oDbAasAawH2Djrwa2C3YH7EuwH4H9AnuMcUWJ7ibBfA7sJGxSoKPA94E2Q6fNqz6vlPn0Aa+W7Uo0vgD6CYoU7MmfNkmkAuxBvCCPYb0Y9utAe/g4H97zNsZvtgZjJ7z2bdm9BjoG2gL6JFKL7LVhpAmwElH3tKxFoqobLDpAvXi+YDaXxxugLrCmrDoD1sFCRUmmrbfEfZEuu4Ow1gZ6KhMHJGXsagToNUnplmrpRpYItKN+dJ0AyGspU7NkSs7U36uWRnZVSxVpq96IH83jtLSe0rJ5TYT5FKk9FGCbPd44FRR99SO3FaMmlpa3RFr0vOCHw7g6Z2D9ARHk3jJgdIsdb1VtRVfIvruhaPWxsRz5opJeAXWADgUeWkK8YctZFWVTOkAIYWOI3flovKo6MXKi5/MFTQQrraWDRE0FabREEGfB1K0DkkqregYTYrEjdxJ+PlrLITK5by+9En7zUT08Qy95McXyUZEgk/+aSlF2Cta+YeofEoqpx2czFIQ/lyW2cSzzjlQXb+NZueNF9gKZl00raLRl91b2PcaSDZJcIZ0mpvaugMTiMWVkMrr4MLWckdctw0RM+2p2T4oTLPpS/5g7T3Y+3nZM8HS+Gj6uDXIlEyTs6SC6KGNJ4DdiN5GMqmct/GsmzjxFtcKSI/R/ks3R+/Qc40gWP7vDdcGSVa/Np1/k64mzFeVNIY0d1Ld6WrAvqClPUGGsFHshQJiCk7Gc1hXMiq3CdT0HNktWF3PX5tzoaBoFS1h7xoe3/Pjwv3Z5tY3Ai20fzFqSdRxwsFmxqFjGOO+jFNNEbrT1Txb4ldjBsVvWRhf2498d+c7aJ7hWa28D7UhVm/+sufIbq+sHFKQEAAA=',
    'policies/AI_CONTRIBUTIONS.md': 'H4sIAAAAAAAC/02TQY7bMAxF9zkFgS66yeQOKbqZRVGgN5BlZsJWFl2RSpCevl+MkwkQOIYlkf+/T32h4/tbMhNznilr9SZTd9Fqu93xne5LqWYmMUql6BX7rmeulPDLWXv1NBWmc1/wpdeZ2zgw254aX4SveHE2xx++kl6rkZ+ZrE+LoLrWAx3JVQtpo/TB1SmnWtVp4tjZ2FbokdHlqVDbYbf7xidtr6X2dOEmpxuhDLd09zRzdM7iKYwNYYtecI5zY7dYXZtcsJ/m5GmPQ8tabnQVP1ORzNV46J9naDqni2h7O2nuhvov3maxXNRC0GDgksorwcC2Nv3N2WlVFL5Byt8+KpD4gb4rDd/hx+mUpiY5TADkzCixfzEGx53pVFQHa3jpTfxGuSRZLKRrd9RHw7lnDzogPDVNgHFO9YNHEsnRc0sP3GnmE8OL1C0+YD521GryL/CRuRTYWtcibMiubqEt3Tzk63qfjhC4p7Vj+2YzyMJbKIE0NUGSt00OLdwY2CfOCWyBJBQ9LJNWPtDPyRPELXiMFx4z05iXIQHTgAm0QVYCEVKMlbvykdEf5pUsQ2MgQqVA8KwBu7+gq40UbEVQKHPpZSiYpIhLQGvaP87bcD5MfLXnED3DwD4HgkHlcSgByASB4+J9htmi54F+PG0ZLI40xzz1GmMtcdHCI64RTn0O/n2IN8roYQvuKthErm/3JPkR+2H3HzkKCe33AwAA',
    'policies/AI_CONTRIBUTIONS.vi.md': 'H4sIAAAAAAAC/4VTzW7TQBC+5ylG4mrlHUpPCHHrC2w2q+wo9jq1dw3h2gNCHAAhhKoKtSaHqgEUqiIhbCEOW/U9/CZ8u07qCCFxiByPd+f7m3lAh7mxBU+c5dyQ9Dd08Ih0134gW3TtajS6fXP3DX8kTf1PMwtf55op69pTS2YWvn1kkrjxyuGKr6Umo7lrX2QUHicuoUJVrJ4mZFVpqfIXVHbteQDZOCrdJOOyBPiYjvI8JZ13zQ9JYqaMBZT/DlCLsyeU4qbcsc2Lf4OOR6OjIrA6k5HorGu/ckLar5b0DAcpY6PRZqoiE8lWROW3b7cybdfUeUIpaNRMpZKF6kkvCq6EVTQVVkCL859MJHZJKUtlSoWi9uusl6n9BXAqjlenXMo0L12hgnFXcs9gAPsaEudBYSC8yNFuSUu/diS75tKN6XHvQpRCk665xksQf4XnBB4INIFpNiE46VTEnvUKUIMEV7BdkkwFgx18an47hLIo8qmTUf3WdKvFMvRq3zMdO18TGJ6iVQYN2ygExyHpEwGXVU4VfI/U+5yRwIGzOi/4eW9t1TWfTTi7sTRx6CjHdLAf75737XVw6LwXktDCpSnaHjtYmiC1LGNYC5L7TKEkj368hNlf9ujFKMkAkWnqzGxMhzDUUCbYWPxUEVu8AwX/C3FsxwZ6zpg4W6QqA8texN9Uh3z64dCwAtOGGdyESBucDbU6CzOAwg1seehBp3IpgMWE05DJsRM092uMyn1MuzmTGC0RxSU79H4FQ6mwYRNlrM614DE9GUQNDgRgnBiWbNdpWIWdonuQcPt/i92Py54HC81QEQfC4FjXviZ9V4e18qvBNGzv0Ho3LX8ARWurWYMEAAA=',
    'policies/UNSOLICITED_PULL_REQUESTS.ja.md': 'H4sIAAAAAAAC/4VT3VLaQBS+z1PsTB+gT9KrPkFkomQmJjQkdugVm6hAAYNa0BYdtEahRAgonaGI8DCbzc9b9OwmOsw4nV6Q2YRz9nx/5x0KVpfJ1ZLgNrEaBN8RvE/wEJ6oYCoK0qVPplQ0BCGsreNhM5xXCV4juVg0JUTwiuAewT7aFWXVgJ+kvzTAn430Hur2CW7Cmbq1sDuDclLGdNyLbw5oDb57UXceexWCz/h0h+ArBgZglK2oN+JIdK2gFUUFLvVYc9tJrhtwiPx92n1gX/xVPL1G27IiwVtRypm6bJTe57TdgmjIW7ICb9A8J3hMn6dJbw1VoXsRD5Zh50/4CNRP4sF5vKxxFMDqOwwXhLgypPU2EncklRFiwOOH++DpCerDBibYRXlzV1SB9J4sfQb2BA82xYB54flR5C6iH0xVJJpGXtPlLwBKUxHX5yzl9E8XdAmoy4aml1AuL6o7ILt1EjxfhNUWsZ9Cp0UrixftfN52zBl0iXUKJIg9IvaSWB6xPQRi5PIMVPStx/o5o02bUXZxGW/pogq1BbOY54oahqzuvCLA43gwpQ7M6/OpFrG+bk4VhKh+H3n1FFiqNJTH9jPLwcThBg+RUSpoKFiPw9ENXBN1Z+HRLXXOotZhJoRVp1cz2qryML0OYeZ8zDzm+ujcHYiJvCcaEtozFRBfzGxnmFWJZWeelMGzm7cx+7DpmJ9UmrFbeY0XdTssYW4/qTiZbiCapsi5EkpwmzpNZt/6ko6rwbyZUsxsgVT9eoxmE2LfE/uU2LfMisz0fvTbChaHXMHmRubSPcuSjX16PIhXC2C5LeYgBMyE/6qfLlcwh93x2PlxyOPnRe0Jmw6iZpvYoOuD+A6zBDJUoEzvRW+f4otw9JNBhVXpTDjmfVp1w86IpX8KQ/FbJYW/2fyXy1AEAAA=',
    'policies/UNSOLICITED_PULL_REQUESTS.md': 'H4sIAAAAAAAC/02TPZLbMAyFe58CM2lt3WGrTIpUOzkARUEWshTJEKQc7enzQMkbFyr4B7z3Pegb/YqagnipPFFuIVDhP4216uXyph808pwKk6w58MqxSryTI22jVoeVC+QXF+9MdXGVFqcUE7mcS9pQUFQbUyq0OokVH5dn/YHeSJdUKuFuTopKWLYwESpXq8d2MqLtlfCY44SC6lPmKwX54LDTLIH1Ssq+Fam7NfJpza7KKME2eJ7ZV1xxcaKNi8zicZriIdH5ZYDNVtPqzL+7w6HS2rTCRiXXKhRaWRhepVJ7gVUYqqWmsp8IlB6C+w3vUN/71GAZ+mlpK3YKb8IPADAt/Df3Oq9gjm7y2QUO9J2x6U7g8OQXCsm7AN9TYn0RKJ9gnDmeV19CvGKly7E/Fhf9cu2QTK/tvnhQrtZLAeR9RReqe07AWQoIQhCwuB3jYM44G4BJ7AhyHgtHy2snZ6MCRAfNL+ZGYaD3Z0zWtYDzyCFBhMQzbNks+K0FM34maFIjh4F+foE6lPiQlGlqxhHP4Gueb+d43A90PN22FNqKnWyx7bdNTBtsdgwtPun3mHrGqt3rM8mJcRx62paeTcvTfu8Ftz2IzOV8S/hfyE2/nccs4dnsPPii5UA/5v//0TGFqMouKNKxASxypCuY2mKvj7nCgNeUO84zVtyP/IA4L9ZyuPwDwcxxEscDAAA=',
    'policies/UNSOLICITED_PULL_REQUESTS.vi.md': 'H4sIAAAAAAAC/32UzW7TQBSF93mKK7GNwjOwYwOqVF5gMnU9o9jXU3tsanYVQl10gViwQBWiIYpQWyqoWlRhL1hMxXvMm3Bm2rgJSCwsZ37uz/nucR7RVp1lVCZ7dVJZmil3zSndvvv93fcLSa07q0n67ktNtgx7x3I0euoWLSnfv9XDJgLDQvv+NeO3wEKJFnl8/17j5ebIOsPpqoJ0V6Srqk4eau3Ure8PLanCdzebpX1/TrnQbPEk5YS2ysIUlciIU99943iNiUNE47slx8IHYzLKd/OcGj2mXZ0ltOP7S5pp3/3iMVk3l/HiB/RTJbIutW0fyyI3wuqpzrCixp2g1blUtB9u55rVZDR6kiZsQ1eXQ/zf4JpQZNCS+v5iE0mZmOJ/tBnhEK50fHMabnwMYY1OXpIE/aMwktga41Z/mMdmRW1VUepXkFAwle4HnhPU+AfhC5ApCFKRQPp+KWkKJevj4VTdnoqH7oxyp4Zy338is+YZUK4rRdNSMFKtSawSazWn4LUN+YJsC8kcfBPTWxXsMGTHQXfBkASqkmzQbaKrImFJGY5NlIghvlkbB23fjy4yLW0c+iLEadqrBc3cGStq6gyyxf1YTakbYZMJPRuIbPTkroIl6mkOiwaOAP0TO+jhxowBpnAnet1cNsJUkXSGkc9BpRlumCLTsl154Z7wXakpWi1C+q+UQ9qKfrTzMGt9h8OC5NaqZmhyMXwyD3FLA9HYPAjxu0LaoqTMfY6fyAVP6Hn0k85NluQw8Z1NMNk5vBpcxBsuRV5gbpAudsrBeN0S4lT4C8AgzlE1zGRfc6wbPB9ij4AcTjnWk9Ef7BGlX2IEAAA=',
}
_RULE_CATALOG: dict[str, dict] | None = None


class KitError(Exception):
    pass


class UsageArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        self.print_usage(sys.stderr)
        self.exit(1, f"{self.prog}: error: {message}\n")


SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "note": 0}
WORKFLOW_SUFFIXES = {".yml", ".yaml"}
PRIVILEGED_EVENTS = ("pull_request_target", "workflow_run", "issue_comment")
UNTRUSTED_EXPRESSION = re.compile(
    r"\$\{\{\s*github\.(?:event\.(?:issue|pull_request|comment|review|head_commit)(?:[^}]*)|head_ref|ref_name)\s*\}\}"
)
WRITE_PERMISSION_SCOPES = frozenset(
    {
        "actions",
        "artifact-metadata",
        "attestations",
        "checks",
        "code-quality",
        "contents",
        "deployments",
        "discussions",
        "id-token",
        "issues",
        "packages",
        "pages",
        "pull-requests",
        "security-events",
        "statuses",
    }
)
IDENTITY_PROXIES = {
    "detect-spam-usernames": "username pattern",
    "min-account-age": "account age",
    "max-daily-forks": "fork activity",
    "require-public-profile": "public-profile state",
    "min-profile-completeness": "profile completeness",
    "min-global-merge-ratio": "global merge history",
    "require-commit-author-match": "commit-author identity",
}


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def read(path: str) -> bytes:
    if EMBEDDED_FILES:
        try:
            return gzip.decompress(base64.b64decode(EMBEDDED_FILES[path]))
        except KeyError as exc:
            raise KitError(f"standalone installer is missing embedded asset: {path}") from exc
    return (ROOT / path).read_bytes()


def rule_catalog() -> dict[str, dict]:
    global _RULE_CATALOG
    if _RULE_CATALOG is not None:
        return _RULE_CATALOG
    try:
        data = json.loads(read("auditor-rules.json"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise KitError(f"invalid embedded auditor rule registry: {exc}") from exc
    if data.get("schema_version") != 1 or not isinstance(data.get("rules"), list):
        raise KitError("unsupported or incomplete auditor rule registry")
    catalog: dict[str, dict] = {}
    required = {
        "id", "title", "default_severity", "description", "safe_remediation",
        "help_anchor", "mappings",
    }
    for item in data["rules"]:
        if not isinstance(item, dict) or set(item) != required:
            raise KitError("auditor rule registry contains an invalid entry")
        rule_id = item["id"]
        if rule_id in catalog or not re.fullmatch(r"MD-(?:GOV|WF|MOD)-[0-9]{3}", rule_id):
            raise KitError(f"invalid or duplicate auditor rule ID: {rule_id!r}")
        if item["default_severity"] not in SEVERITY_ORDER:
            raise KitError(f"invalid severity for auditor rule {rule_id}")
        catalog[rule_id] = item
    _RULE_CATALOG = catalog
    return catalog


def rule_metadata(rule_id: str) -> dict:
    try:
        return rule_catalog()[rule_id]
    except KeyError as exc:
        raise KitError(f"finding uses undocumented rule ID: {rule_id}") from exc


def rule_help_uri(rule_id: str) -> str:
    return f"{RULE_HELP_BASE}#{rule_metadata(rule_id)['help_anchor']}"


def detect_repository(target: Path) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(target), "remote", "get-url", "origin"],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        return None
    remote = result.stdout.strip()
    match = re.match(
        r"(?:https://github\.com/|ssh://git@github\.com/|git@github\.com:)([^/]+/[^/]+?)(?:\.git)?$",
        remote,
    )
    return match.group(1) if match else None


def valid_repository(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", value))


def localized_source(language: str, stem: str) -> str:
    return f"kits/maintainer-defense-kit/locales/{language}/{stem}"


def policy_source(language: str, name: str) -> str:
    suffix = "" if language == "en" else f".{language}"
    return f"policies/{name}{suffix}.md"


def playbook_source(language: str) -> str:
    return "docs/PLAYBOOK.md" if language == "en" else f"docs/{language}/PLAYBOOK.md"


def label_spec(language: str) -> bytes:
    descriptions = {
        "en": "Neutral queue for maintainer review; not an authorship or intent judgment.",
        "vi": "Hàng đợi trung lập để maintainer review; không kết luận về tác giả hay ý định.",
        "ja": "メンテナー確認用の中立的なキュー。作成者や意図を断定するものではありません。",
    }
    payload = {
        "labels": [
            {
                "name": "needs-human-review",
                "color": "D4C5F9",
                "description": descriptions[language],
                "optional_for_manual_triage": ["balanced", "hardened"],
            }
        ]
    }
    return (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()


def desired_files(profile: str, language: str, repository: str) -> dict[str, bytes]:
    config = read(localized_source(language, "config.yml.tmpl")).replace(
        b"{{REPOSITORY}}", repository.encode()
    )
    files = {
        ".github/PULL_REQUEST_TEMPLATE.md": read(
            localized_source(language, "pull_request_template.md")
        ),
        ".github/ISSUE_TEMPLATE/bug.yml": read(localized_source(language, "bug.yml")),
        ".github/ISSUE_TEMPLATE/config.yml": config,
        ".github/maintainer-defense-labels.json": label_spec(language),
        "docs/maintainer-defense/AI_CONTRIBUTIONS.md": read(
            policy_source(language, "AI_CONTRIBUTIONS")
        ),
        "docs/maintainer-defense/UNSOLICITED_PULL_REQUESTS.md": read(
            policy_source(language, "UNSOLICITED_PULL_REQUESTS")
        ),
        "docs/maintainer-defense/PLAYBOOK.md": read(playbook_source(language)),
        "docs/maintainer-defense/ADOPTION_RECORD.md": read(
            localized_source(language, "adoption-record.md")
        ),
    }
    if profile == "observe":
        files[".github/workflows/pr-quality.yml"] = read(
            "kits/maintainer-defense-kit/profiles/observe/.github/workflows/pr-quality.yml"
        )
    else:
        files[".github/workflows/pr-quality.yml"] = read(
            "kits/balanced/.github/workflows/pr-quality.yml"
        )
    if profile == "hardened":
        files[".github/workflows/dependency-review.yml"] = read(
            "kits/workflow-hardening/.github/workflows/dependency-review.yml"
        )
        files[".github/workflows/zizmor.yml"] = read(
            "kits/workflow-hardening/.github/workflows/zizmor.yml"
        )
    return files


def destination(target: Path, relative: str) -> Path:
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts or not candidate.parts:
        raise KitError(f"unsafe manifest path: {relative!r}")
    path = target.joinpath(*candidate.parts)
    current = target
    for part in candidate.parts:
        current = current / part
        if current.is_symlink():
            raise KitError(f"refusing to traverse symbolic link: {current}")
    return path


def load_manifest(target: Path) -> dict:
    path = target / MANIFEST
    if not path.is_file():
        raise KitError(f"no installation manifest found at {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise KitError(f"invalid installation manifest: {exc}") from exc
    if data.get("schema_version") != 1 or not isinstance(data.get("files"), list):
        raise KitError("unsupported or incomplete installation manifest")
    seen = set()
    for item in data["files"]:
        if not isinstance(item, dict) or set(item) != {"path", "sha256", "owned"}:
            raise KitError("installation manifest has an invalid file entry")
        if (
            not isinstance(item["path"], str)
            or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"])
            or not isinstance(item["owned"], bool)
        ):
            raise KitError("installation manifest has invalid path, digest, or ownership data")
        destination(target, item["path"])
        if item["path"] in seen:
            raise KitError(f"duplicate installation manifest path: {item['path']}")
        seen.add(item["path"])
    return data


def check_manifest_files(target: Path, manifest: dict) -> list[str]:
    problems = []
    for item in manifest["files"]:
        path = destination(target, item["path"])
        if path.is_symlink() or not path.is_file():
            problems.append(f"MISSING  {item['path']}")
        elif digest(path.read_bytes()) != item["sha256"]:
            problems.append(f"MODIFIED {item['path']}")
    return problems


def install(target: Path, profile: str, language: str, repository: str, apply: bool) -> None:
    if (target / MANIFEST).exists():
        raise KitError(f"{MANIFEST} already exists; verify or uninstall the current kit")
    files = desired_files(profile, language, repository)
    conflicts = []
    entries = []
    for relative, content in sorted(files.items()):
        try:
            path = destination(target, relative)
        except KitError as exc:
            conflicts.append(f"CONFLICT {relative}: {exc}")
            continue
        if path.is_symlink() or (path.exists() and not path.is_file()):
            conflicts.append(f"CONFLICT {relative} is not a regular file")
        elif path.is_file() and path.read_bytes() != content:
            conflicts.append(f"CONFLICT {relative} already exists with different content")
        else:
            owned = not path.exists()
            print(f"{'CREATE' if owned else 'KEEP  '} {relative}")
            entries.append({"path": relative, "sha256": digest(content), "owned": owned})
    if conflicts:
        raise KitError("refusing to overwrite existing content:\n" + "\n".join(conflicts))
    if not apply:
        print("DRY RUN: no files written; add --apply to install")
        return

    created: list[Path] = []
    try:
        for relative, content in sorted(files.items()):
            path = destination(target, relative)
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                created.append(path)
        manifest = {
            "schema_version": 1,
            "kit_version": KIT_VERSION,
            "profile": profile,
            "language": language,
            "repository": repository,
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "files": entries,
        }
        temporary_manifest = target / f"{MANIFEST}.tmp"
        temporary_manifest.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(temporary_manifest, target / MANIFEST)
    except Exception:
        (target / f"{MANIFEST}.tmp").unlink(missing_ok=True)
        for path in reversed(created):
            path.unlink(missing_ok=True)
            remove_empty_parents(path, target)
        raise
    print(f"INSTALLED {profile}/{language}; manifest: {MANIFEST}")


def verify(target: Path) -> None:
    manifest = load_manifest(target)
    problems = check_manifest_files(target, manifest)
    if problems:
        raise KitError("installation verification failed:\n" + "\n".join(problems))
    print(
        f"VERIFIED {manifest['profile']}/{manifest['language']}: "
        f"{len(manifest['files'])} files match the manifest"
    )


def remove_empty_parents(path: Path, target: Path) -> None:
    current = path.parent
    while current != target and target in current.parents:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def uninstall(target: Path) -> None:
    manifest = load_manifest(target)
    problems = check_manifest_files(target, manifest)
    owned_problems = [
        problem
        for problem in problems
        if next(
            item["owned"]
            for item in manifest["files"]
            if item["path"] == problem.split(maxsplit=1)[1]
        )
    ]
    if owned_problems:
        raise KitError(
            "refusing to remove modified or missing installer-owned files:\n"
            + "\n".join(owned_problems)
        )
    removed = []
    for item in reversed(manifest["files"]):
        if not item["owned"]:
            continue
        path = destination(target, item["path"])
        path.unlink()
        removed.append(path)
        remove_empty_parents(path, target)
    (target / MANIFEST).unlink()
    print(f"UNINSTALLED {len(removed)} installer-owned files; pre-existing files were kept")


def relative_path(target: Path, path: Path) -> str:
    return path.relative_to(target).as_posix()


def line_column(text: str, needle: str) -> tuple[int, int]:
    offset = text.find(needle)
    if offset < 0:
        return 1, 1
    line = text.count("\n", 0, offset) + 1
    previous = text.rfind("\n", 0, offset)
    return line, offset - previous


def unified_patch(path: str, before: str, after: str) -> str:
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
        )
    )


def make_finding(
    rule_id: str,
    severity: str,
    confidence: str,
    path: str,
    line: int,
    column: int,
    message: str,
    threat_scenario: str,
    recommendation: str,
    *,
    before: str | None = None,
    after: str | None = None,
    fix_safety: str | None = None,
) -> dict:
    metadata = rule_metadata(rule_id)
    if severity != metadata["default_severity"]:
        raise KitError(
            f"finding severity {severity!r} does not match {rule_id} registry severity "
            f"{metadata['default_severity']!r}"
        )
    finding = {
        "rule_id": rule_id,
        "severity": severity,
        "confidence": confidence,
        "location": {"path": path, "line": line, "column": column},
        "message": message,
        "threat_scenario": threat_scenario,
        "recommendation": recommendation,
        "fingerprint": hashlib.sha256(
            f"{rule_id}:{path}:{message}".encode()
        ).hexdigest()[:24],
        "fix": {"available": False},
    }
    if before is not None and after is not None and before != after:
        finding["fix"] = {
            "available": True,
            "safety": fix_safety or "review-required",
            "patch": unified_patch(path, before, after),
        }
    return finding


def replace_line_value(text: str, line_index: int, value: str) -> str:
    lines = text.splitlines(keepends=True)
    ending = "\n" if lines[line_index].endswith("\n") else ""
    prefix = lines[line_index].split(":", 1)[0]
    comment = ""
    if " #" in lines[line_index]:
        comment = " #" + lines[line_index].split(" #", 1)[1].rstrip("\n")
    lines[line_index] = f"{prefix}: {value}{comment}{ending}"
    return "".join(lines)


def governance_findings(target: Path) -> list[dict]:
    findings: list[dict] = []
    security_candidates = (
        target / "SECURITY.md",
        target / ".github/SECURITY.md",
        target / "docs/SECURITY.md",
    )
    if not any(path.is_file() for path in security_candidates):
        findings.append(
            make_finding(
                "MD-GOV-001", "medium", "high", "SECURITY.md", 1, 1,
                "No repository security policy was found.",
                "A reporter may disclose a vulnerability publicly or abandon the report because no private, supported route is documented.",
                "Add SECURITY.md with supported versions, a private reporting route, response expectations, and a warning not to include secrets in public issues.",
            )
        )

    codeowners_candidates = (
        target / ".github/CODEOWNERS",
        target / "CODEOWNERS",
        target / "docs/CODEOWNERS",
    )
    codeowners = next((path for path in codeowners_candidates if path.is_file()), None)
    if codeowners is None:
        findings.append(
            make_finding(
                "MD-GOV-002", "medium", "high", ".github/CODEOWNERS", 1, 1,
                "No CODEOWNERS file protects repository control-plane files.",
                "A workflow, issue-template, or policy change can be merged without review from the people responsible for repository security and moderation.",
                "Add a real owner for .github/workflows/, .github/ISSUE_TEMPLATE/, SECURITY.md, and CODEOWNERS; do not use a placeholder account.",
            )
        )
    else:
        content = codeowners.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"(?m)^\s*(?:/)?\.github(?:/|\s)", content):
            rel = relative_path(target, codeowners)
            findings.append(
                make_finding(
                    "MD-GOV-003", "medium", "medium", rel, 1, 1,
                    "CODEOWNERS does not explicitly cover .github/.",
                    "A broad ownership rule may be changed or bypassed without an explicit review boundary for workflows and repository automation.",
                    "Add an explicit /.github/ ownership rule naming the responsible team.",
                )
            )

    issue_dir = target / ".github/ISSUE_TEMPLATE"
    issue_forms = (
        [path for path in issue_dir.iterdir() if path.suffix in WORKFLOW_SUFFIXES and path.name != "config.yml"]
        if issue_dir.is_dir() else []
    )
    if not issue_forms:
        findings.append(
            make_finding(
                "MD-GOV-004", "low", "high", ".github/ISSUE_TEMPLATE", 1, 1,
                "No structured issue form was found.",
                "Unstructured reports can omit reproduction steps and expected behavior, increasing maintainer triage cost and security-report noise.",
                "Add at least one YAML issue form that requests reproducible evidence and directs vulnerabilities to a private reporting channel.",
            )
        )

    update_configs = (
        target / ".github/dependabot.yml",
        target / ".github/dependabot.yaml",
        target / "renovate.json",
        target / ".github/renovate.json",
        target / "renovate.json5",
    )
    if not any(path.is_file() for path in update_configs):
        findings.append(
            make_finding(
                "MD-GOV-005", "low", "high", ".github", 1, 1,
                "No machine-readable dependency update policy was found.",
                "Immutable Action and package pins can remain on vulnerable versions when no update mechanism or review cadence is configured.",
                "Configure Dependabot or Renovate for the ecosystems used by the repository, including github-actions where applicable.",
            )
        )

    local_expectation = any(
        pattern in path.read_text(encoding="utf-8", errors="replace").lower()
        for path in list(target.glob("*.md")) + list((target / "docs").glob("*.md") if (target / "docs").is_dir() else [])
        for pattern in ("branch protection", "ruleset", "required review", "protected branch")
    )
    settings_files = (target / ".github/settings.yml", target / ".github/repository.yml")
    if not local_expectation and not any(path.is_file() for path in settings_files):
        findings.append(
            make_finding(
                "MD-GOV-006", "note", "medium", ".github", 1, 1,
                "Branch-protection expectations are not documented in the checkout.",
                "Contributors and maintainers cannot tell which reviews, status checks, or force-push restrictions are intended, and local auditing cannot detect configuration drift.",
                "Document expected rulesets or branch protections and verify actual settings separately with a read-only GitHub API audit.",
            )
        )
    return findings


def yaml_block(lines: list[str], index: int, indentation: int) -> str:
    """Return the surrounding indentation-delimited YAML block."""
    start = index
    while start > 0:
        candidate = lines[start]
        stripped = candidate.lstrip()
        current = len(candidate) - len(stripped)
        if current == indentation and stripped and not stripped.startswith("#"):
            break
        start -= 1
    end = index + 1
    while end < len(lines):
        candidate = lines[end]
        stripped = candidate.lstrip()
        current = len(candidate) - len(stripped)
        if stripped and not stripped.startswith("#") and current <= indentation:
            break
        end += 1
    return "\n".join(lines[start:end])


def declared_write_scopes(lines: list[str], indentation: int) -> tuple[bool, set[str]]:
    prefix = " " * indentation
    for index, line in enumerate(lines):
        match = re.match(rf"^{re.escape(prefix)}permissions\s*:\s*(.*?)\s*$", line)
        if not match:
            continue
        value = match.group(1).split("#", 1)[0].strip()
        if value == "write-all":
            return True, set(WRITE_PERMISSION_SCOPES)
        if value in {"{}", "read-all"}:
            return True, set()
        scopes: set[str] = set()
        for candidate in lines[index + 1 :]:
            stripped = candidate.lstrip()
            current = len(candidate) - len(stripped)
            if stripped and not stripped.startswith("#") and current <= indentation:
                break
            permission = re.match(r"\s*([a-z-]+)\s*:\s*write\b", candidate)
            if permission and permission.group(1) in WRITE_PERMISSION_SCOPES:
                scopes.add(permission.group(1))
        return True, scopes
    return False, set()


def permission_scope(lines: list[str], evidence_index: int) -> set[str]:
    """Return effective write or credential-minting scopes for one job."""
    job_block = yaml_block(lines, evidence_index, 2).splitlines()
    job_declared, job_scopes = declared_write_scopes(job_block, 4)
    if job_declared:
        return job_scopes
    _, top_scopes = declared_write_scopes(lines, 0)
    return top_scopes


def permission_scope_writes(lines: list[str], evidence_index: int) -> bool:
    return bool(permission_scope(lines, evidence_index))


def run_block_injection(lines: list[str], run_index: int) -> tuple[int, int] | None:
    """Locate a direct untrusted expression in one run scalar or block."""
    line = lines[run_index]
    run_match = re.match(r"^(\s*)(?:-\s*)?run\s*:\s*(.*)$", line)
    if not run_match:
        return None
    value = run_match.group(2)
    inline = UNTRUSTED_EXPRESSION.search(value)
    if inline:
        value_column = line.find(value) if value else len(line)
        return run_index + 1, value_column + inline.start() + 1
    if value and not re.fullmatch(r"[|>][+-]?\d*", value.split("#", 1)[0].strip()):
        return None
    indentation = len(run_match.group(1))
    for index in range(run_index + 1, len(lines)):
        candidate = lines[index]
        stripped = candidate.lstrip()
        current = len(candidate) - len(stripped)
        if stripped and not stripped.startswith("#") and current <= indentation:
            break
        match = UNTRUSTED_EXPRESSION.search(candidate)
        if match:
            return index + 1, match.start() + 1
    return None


@dataclass(frozen=True)
class WorkflowRecord:
    path: Path
    name: str
    triggers: frozenset[str]
    workflow_run_names: frozenset[str]
    uploads_artifact: bool
    uploaded_artifact_names: frozenset[str]
    downloads_artifact: bool
    executes_downloaded_content: bool
    executed_artifact_names: frozenset[str]
    has_privileged_authority: bool


@dataclass(frozen=True)
class Suppression:
    rule_id: str
    reason: str
    owner: str
    expires_on: date
    fingerprint: str | None = None
    path: str | None = None
    expired: bool = False


def load_suppressions(path: Path, today: date) -> list[Suppression]:
    try:
        data = json.loads(path.expanduser().read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise KitError(f"invalid suppression JSON {path}: {exc}") from exc
    if not isinstance(data, dict) or set(data) != {"schema_version", "suppressions"}:
        raise KitError("suppression config must contain only schema_version and suppressions")
    if data["schema_version"] != 1 or not isinstance(data["suppressions"], list):
        raise KitError("suppression config must use schema_version 1 and a suppressions array")
    required = {"rule_id", "reason", "owner", "expires_on"}
    allowed = required | {"fingerprint", "path"}
    entries: list[Suppression] = []
    selectors: set[tuple[str, str | None, str | None]] = set()
    for index, item in enumerate(data["suppressions"]):
        label = f"suppression #{index + 1}"
        if not isinstance(item, dict) or not required <= set(item) or not set(item) <= allowed:
            raise KitError(f"{label} has missing or unknown fields")
        rule_id = item["rule_id"]
        if not isinstance(rule_id, str) or rule_id not in rule_catalog():
            raise KitError(f"{label} uses unknown rule_id: {rule_id!r}")
        reason = item["reason"]
        owner = item["owner"]
        if not isinstance(reason, str) or not reason.strip():
            raise KitError(f"{label} requires a non-empty reason")
        if not isinstance(owner, str) or not owner.strip():
            raise KitError(f"{label} requires a non-empty owner")
        raw_expiry = item["expires_on"]
        if not isinstance(raw_expiry, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_expiry):
            raise KitError(f"{label} expires_on must use YYYY-MM-DD")
        try:
            expires_on = date.fromisoformat(raw_expiry)
        except ValueError as exc:
            raise KitError(f"{label} has invalid expires_on date: {raw_expiry}") from exc
        fingerprint = item.get("fingerprint")
        relative = item.get("path")
        if fingerprint is None and relative is None:
            raise KitError(f"{label} requires fingerprint or path")
        if fingerprint is not None and (
            not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{24}", fingerprint)
        ):
            raise KitError(f"{label} fingerprint must be 24 lowercase hexadecimal characters")
        if relative is not None:
            if not isinstance(relative, str) or not relative or "\\" in relative:
                raise KitError(f"{label} path must be a non-empty repository-relative POSIX path")
            normalized = PurePosixPath(relative)
            if normalized.is_absolute() or ".." in normalized.parts or str(normalized) != relative:
                raise KitError(f"{label} path must be a normalized repository-relative POSIX path")
        selector = (rule_id, fingerprint, relative)
        if selector in selectors:
            raise KitError(f"duplicate suppression selector for {rule_id}")
        selectors.add(selector)
        entries.append(
            Suppression(
                rule_id=rule_id,
                reason=reason.strip(),
                owner=owner.strip(),
                expires_on=expires_on,
                fingerprint=fingerprint,
                path=relative,
                expired=expires_on < today,
            )
        )
    return entries


def apply_suppressions(
    report: dict, entries: list[Suppression]
) -> tuple[dict, int, list[str]]:
    active = [(index, entry) for index, entry in enumerate(entries) if not entry.expired]
    warnings = [
        f"Suppression {entry.rule_id} owned by {entry.owner} expired on {entry.expires_on.isoformat()}"
        for entry in entries
        if entry.expired
    ]
    matched: set[int] = set()
    emitted: list[dict] = []
    suppressed = 0
    for finding in report["findings"]:
        matching = []
        for index, entry in active:
            if entry.rule_id != finding["rule_id"]:
                continue
            if entry.fingerprint is not None and entry.fingerprint != finding["fingerprint"]:
                continue
            if entry.path is not None and entry.path != finding["location"]["path"]:
                continue
            matching.append(index)
        if matching:
            matched.update(matching)
            suppressed += 1
        else:
            emitted.append(finding)
    unmatched = [entry for index, entry in active if index not in matched]
    if unmatched:
        entry = unmatched[0]
        selector = entry.fingerprint or entry.path
        raise KitError(
            f"active suppression {entry.rule_id} selector {selector!r} matches no finding"
        )
    return report_with_findings(report, emitted), suppressed, warnings


def inline_yaml_values(value: str) -> frozenset[str]:
    value = value.split("#", 1)[0].strip()
    if value.startswith("[") and value.endswith("]"):
        value = value[1:-1]
    return frozenset(
        item.strip().strip("\"'")
        for item in value.split(",")
        if item.strip().strip("\"'")
    )


def workflow_triggers(lines: list[str]) -> frozenset[str]:
    for index, line in enumerate(lines):
        match = re.match(r"^on\s*:\s*(.*?)\s*$", line)
        if not match:
            continue
        value = match.group(1)
        if value:
            return inline_yaml_values(value)
        triggers: set[str] = set()
        for candidate in lines[index + 1 :]:
            stripped = candidate.lstrip()
            indentation = len(candidate) - len(stripped)
            if stripped and not stripped.startswith("#") and indentation == 0:
                break
            event = re.match(r"^  ([A-Za-z_][A-Za-z0-9_-]*)\s*:", candidate)
            if event:
                triggers.add(event.group(1))
        return frozenset(triggers)
    return frozenset()


def workflow_run_sources(lines: list[str]) -> frozenset[str]:
    for index, line in enumerate(lines):
        if not re.match(r"^  workflow_run\s*:\s*$", line):
            continue
        for source_index in range(index + 1, len(lines)):
            candidate = lines[source_index]
            stripped = candidate.lstrip()
            indentation = len(candidate) - len(stripped)
            if stripped and not stripped.startswith("#") and indentation <= 2:
                break
            match = re.match(r"^    workflows\s*:\s*(.*?)\s*$", candidate)
            if not match:
                continue
            value = match.group(1)
            if value:
                return inline_yaml_values(value)
            names: set[str] = set()
            for item in lines[source_index + 1 :]:
                item_stripped = item.lstrip()
                item_indentation = len(item) - len(item_stripped)
                if item_stripped and not item_stripped.startswith("#") and item_indentation <= 4:
                    break
                item_match = re.match(r"^\s+-\s*(.*?)\s*$", item)
                if item_match:
                    names.update(inline_yaml_values(item_match.group(1)))
            return frozenset(names)
    return frozenset()


def yaml_job_bounds(lines: list[str], evidence_index: int) -> tuple[int, int]:
    start = evidence_index
    while start >= 0 and not re.match(r"^  [A-Za-z0-9_.-]+\s*:\s*$", lines[start]):
        start -= 1
    if start < 0:
        return evidence_index, evidence_index + 1
    end = start + 1
    while end < len(lines):
        stripped = lines[end].lstrip()
        indentation = len(lines[end]) - len(stripped)
        if stripped and not stripped.startswith("#") and indentation <= 2:
            break
        end += 1
    return start, end


def run_scalar_text(lines: list[str], run_index: int) -> str:
    match = re.match(r"^(\s*)(?:-\s*)?run\s*:\s*(.*)$", lines[run_index])
    if not match:
        return ""
    chunks = [match.group(2)]
    indentation = len(match.group(1))
    for candidate in lines[run_index + 1 :]:
        stripped = candidate.lstrip()
        current = len(candidate) - len(stripped)
        if stripped and not stripped.startswith("#") and current <= indentation:
            break
        chunks.append(stripped)
    return "\n".join(chunks)


def action_inputs(lines: list[str], action_index: int) -> dict[str, str]:
    action_indent = len(lines[action_index]) - len(lines[action_index].lstrip())
    with_indent: int | None = None
    inputs: dict[str, str] = {}
    for candidate in lines[action_index + 1 :]:
        stripped = candidate.lstrip()
        indentation = len(candidate) - len(stripped)
        if stripped and indentation <= action_indent:
            break
        if re.match(r"^with\s*:\s*$", stripped):
            with_indent = indentation
            continue
        if with_indent is None:
            continue
        if stripped and indentation <= with_indent:
            break
        match = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$", stripped)
        if match:
            inputs[match.group(1)] = match.group(2).split(" #", 1)[0].strip().strip("\"'")
    return inputs


def literal_relative_path(value: str) -> PurePosixPath | None:
    if not value or "${{" in value or any(character in value for character in "`$<>\\"):
        return None
    path = PurePosixPath(value.removeprefix("./"))
    if path.is_absolute() or ".." in path.parts:
        return None
    return path


def executed_local_paths(command: str) -> frozenset[PurePosixPath]:
    paths: set[PurePosixPath] = set()
    interpreters = {"bash", "sh", "python", "python3", "node", "ruby", "perl"}
    for segment in re.split(r"(?:&&|\|\||[;|\n])", command):
        try:
            tokens = shlex.split(segment, comments=True, posix=True)
        except ValueError:
            continue
        while tokens and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", tokens[0]):
            tokens.pop(0)
        if not tokens:
            continue
        candidate: str | None = None
        executable = PurePosixPath(tokens[0]).name
        if executable in interpreters:
            for token in tokens[1:]:
                if token in {"-c", "-m"}:
                    candidate = None
                    break
                if not token.startswith("-"):
                    candidate = token
                    break
        elif tokens[0] in {"source", "."} and len(tokens) > 1:
            candidate = tokens[1]
        elif "/" in tokens[0] and not tokens[0].startswith("/"):
            candidate = tokens[0]
        if candidate:
            path = literal_relative_path(candidate)
            if path is not None:
                paths.add(path)
    return frozenset(paths)


def path_is_within(path: PurePosixPath, destination: PurePosixPath) -> bool:
    return destination == PurePosixPath(".") or path == destination or destination in path.parents


def index_workflows(target: Path) -> list[WorkflowRecord]:
    records: list[WorkflowRecord] = []
    workflow_dir = target / ".github/workflows"
    if not workflow_dir.is_dir():
        return records
    for path in sorted(workflow_dir.rglob("*")):
        if not path.is_file() or path.suffix not in WORKFLOW_SUFFIXES:
            continue
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        name_match = next((re.match(r"^name\s*:\s*(.*?)\s*$", line) for line in lines if re.match(r"^name\s*:", line)), None)
        name = name_match.group(1).strip("\"'") if name_match else path.stem
        upload_indexes = [
            index for index, line in enumerate(lines)
            if re.search(r"uses:\s*[\"']?actions/upload-artifact@", line)
        ]
        uploaded_names: set[str] = set()
        for upload_index in upload_indexes:
            upload_name = action_inputs(lines, upload_index).get("name", "artifact")
            if upload_name and "${{" not in upload_name:
                uploaded_names.add(upload_name)
        download_indexes = [
            index for index, line in enumerate(lines)
            if re.search(r"uses:\s*[\"']?actions/download-artifact@", line)
        ]
        executed_names: set[str] = set()
        privileged = False
        for download_index in download_indexes:
            inputs = action_inputs(lines, download_index)
            destination = literal_relative_path(inputs.get("path", "."))
            remote_run = "github.event.workflow_run.id" in inputs.get("run-id", "")
            authenticated = bool(inputs.get("github-token"))
            if destination is None or not remote_run or not authenticated:
                continue
            _, job_end = yaml_job_bounds(lines, download_index)
            for execution_index in range(download_index + 1, job_end):
                if re.match(r"^\s*(?:-\s*)?run\s*:", lines[execution_index]):
                    executed_paths = executed_local_paths(
                        run_scalar_text(lines, execution_index)
                    )
                else:
                    local_action = re.match(
                        r"^\s*-\s*uses:\s*[\"']?(\./[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*)",
                        lines[execution_index],
                    )
                    executed_path = (
                        literal_relative_path(local_action.group(1)) if local_action else None
                    )
                    executed_paths = (
                        frozenset({executed_path})
                        if executed_path is not None
                        else frozenset()
                    )
                if not any(
                    path_is_within(executed_path, destination)
                    for executed_path in executed_paths
                ):
                    continue
                job_start, _ = yaml_job_bounds(lines, execution_index)
                job_text = "\n".join(lines[job_start:job_end])
                execution_is_privileged = bool(
                    permission_scope(lines, execution_index)
                    or re.search(r"\$\{\{\s*secrets\.|secrets:\s*inherit", job_text)
                )
                if execution_is_privileged:
                    name = inputs.get("name")
                    if name and "${{" not in name:
                        executed_names.add(name)
                    elif not name:
                        executed_names.add("*")
                    privileged = True
                break
        records.append(
            WorkflowRecord(
                path=path,
                name=name,
                triggers=workflow_triggers(lines),
                workflow_run_names=workflow_run_sources(lines),
                uploads_artifact=bool(upload_indexes),
                uploaded_artifact_names=frozenset(uploaded_names),
                downloads_artifact=bool(download_indexes),
                executes_downloaded_content=bool(executed_names),
                executed_artifact_names=frozenset(executed_names),
                has_privileged_authority=privileged,
            )
        )
    return records


def artifact_trust_findings(target: Path, records: list[WorkflowRecord]) -> list[dict]:
    producers = [
        record for record in records
        if record.uploads_artifact and "pull_request" in record.triggers
    ]
    findings: list[dict] = []
    for consumer in records:
        if not (
            "workflow_run" in consumer.triggers
            and consumer.downloads_artifact
            and consumer.executes_downloaded_content
            and consumer.has_privileged_authority
        ):
            continue
        for producer in producers:
            if producer.name not in consumer.workflow_run_names:
                continue
            if not (
                "*" in consumer.executed_artifact_names
                or producer.uploaded_artifact_names & consumer.executed_artifact_names
            ):
                continue
            producer_rel = relative_path(target, producer.path)
            consumer_rel = relative_path(target, consumer.path)
            text = consumer.path.read_text(encoding="utf-8", errors="replace")
            line, column = line_column(text, "actions/download-artifact@")
            findings.append(
                make_finding(
                    "MD-WF-008", "critical", "high", consumer_rel, line, column,
                    f"Privileged workflow executes an artifact from pull-request workflow {producer_rel}.",
                    f"Untrusted pull-request code in {producer_rel} can alter an uploaded artifact that {consumer_rel} downloads and executes with secrets, OIDC, or repository write authority.",
                    "Treat the artifact as untrusted data: verify an immutable digest and parse it without execution, or rebuild it from trusted source in the privileged workflow.",
                )
            )
    return findings


def workflow_findings(target: Path, path: Path) -> list[dict]:
    findings: list[dict] = []
    rel = relative_path(target, path)
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    top_permissions = any(re.match(r"^permissions\s*:", line) for line in lines)
    if not top_permissions:
        insertion = "permissions: {}\n\n"
        insert_at = 0
        if lines and re.match(r"^name\s*:", lines[0]):
            first_end = text.find("\n") + 1
            insert_at = first_end if first_end > 0 else len(text)
        after = text[:insert_at] + insertion + text[insert_at:]
        findings.append(
            make_finding(
                "MD-WF-001", "medium", "high", rel, 1, 1,
                "Workflow has no top-level permissions boundary.",
                "A newly added job can silently inherit broader repository-default GITHUB_TOKEN permissions than its author intended.",
                "Declare top-level permissions: {} and grant the minimum permissions required by each job.",
                before=text, after=after, fix_safety="review-required",
            )
        )

    for index, line in enumerate(lines):
        if re.search(r"\bpermissions\s*:\s*write-all\b", line):
            after = replace_line_value(text, index, "{}")
            findings.append(
                make_finding(
                    "MD-WF-002", "high", "high", rel, index + 1, line.find("write-all") + 1,
                    "Workflow grants write-all token permissions.",
                    "Any compromised Action or command in this permission scope can modify repository content and other sensitive resources.",
                    "Replace write-all with an empty default and grant only the exact job-level write permissions required.",
                    before=text, after=after, fix_safety="review-required",
                )
            )

        uses = re.search(r"\buses:\s*[\"']?([^@\"'\s]+)@([^\"'\s#]+)[\"']?", line)
        if uses and not re.fullmatch(r"[0-9a-fA-F]{40}", uses.group(2)):
            findings.append(
                make_finding(
                    "MD-WF-003", "medium", "high", rel, index + 1, uses.start(2) + 1,
                    f"Action {uses.group(1)} is not pinned to a full commit SHA.",
                    "A mutable tag or branch can move to compromised code without a reviewed workflow change.",
                    "Resolve the reviewed release to a 40-character commit SHA, retain the release tag in a comment, and configure automated pin updates.",
                )
            )

    privileged = [event for event in PRIVILEGED_EVENTS if re.search(rf"(?m)^\s{{0,2}}{event}\s*:", text)]
    checkout_indexes = [
        index for index, line in enumerate(lines)
        if re.search(r"uses:\s*[\"']?actions/checkout@", line)
    ]
    checkout = bool(checkout_indexes)
    untrusted_ref = bool(re.search(r"github\.(?:event\.pull_request\.(?:head\.(?:sha|ref)|head)|head_ref)|refs/pull/", text))
    if privileged and checkout and untrusted_ref:
        needle = privileged[0]
        line, column = line_column(text, needle)
        findings.append(
            make_finding(
                "MD-WF-004", "high", "high", rel, line, column,
                f"Privileged event {needle} checks out an attacker-influenced revision.",
                "A fork or attacker-controlled event influences the checked-out revision inside a context that can receive base-repository authority.",
                "Split metadata handling from untrusted-code execution; use pull_request with read-only permissions for code execution and never check out a fork head in the privileged job.",
            )
        )
    if privileged:
        untrusted_pattern = re.compile(
            r"github\.(?:event\.pull_request\.(?:head\.(?:sha|ref)|head)|head_ref)|refs/pull/"
        )
        for evidence_index, evidence_line in enumerate(lines):
            if not untrusted_pattern.search(evidence_line):
                continue
            job_block = yaml_block(lines, evidence_index, 2)
            job_has_secrets = bool(
                re.search(r"\$\{\{\s*secrets\.|secrets:\s*inherit", job_block)
            )
            scopes = permission_scope(lines, evidence_index)
            if not job_has_secrets and not scopes:
                continue
            needle = "secrets." if "secrets." in job_block else evidence_line.strip()
            line, column = line_column(text, needle)
            findings.append(
                make_finding(
                    "MD-WF-005", "critical", "high", rel, line, column,
                    "Untrusted pull-request input can reach a privileged workflow with secrets or write authority.",
                    "An attacker can modify fork code or metadata so a privileged job executes attacker-controlled commands and exfiltrates credentials or changes the repository.",
                    "Remove the untrusted checkout/execution path from the privileged event and move it to an isolated pull_request workflow with no secrets and read-only permissions.",
                )
            )
            break
    for checkout_index in checkout_indexes:
        checkout_line = lines[checkout_index]
        indentation = len(checkout_line) - len(checkout_line.lstrip())
        step_block = yaml_block(lines, checkout_index, max(0, indentation - 2))
        if permission_scope_writes(lines, checkout_index) and "persist-credentials: false" not in step_block:
            column = checkout_line.find("actions/checkout@") + 1
            findings.append(
                make_finding(
                    "MD-WF-006", "medium", "medium", rel, checkout_index + 1, column,
                    "Checkout may persist a write-capable token in the workspace.",
                    "A later command or compromised build step can recover the credential from Git configuration and use its repository authority.",
                    "Set persist-credentials: false unless a reviewed step explicitly needs authenticated Git operations.",
                )
            )

    for run_index, run_line in enumerate(lines):
        if not re.match(r"^\s*(?:-\s*)?run\s*:", run_line):
            continue
        injection = run_block_injection(lines, run_index)
        if not injection:
            continue
        line, column = injection
        findings.append(
            make_finding(
                "MD-WF-007", "high", "high", rel, line, column,
                "Untrusted GitHub event data is interpolated directly into a shell command.",
                "An attacker can craft event text that changes the generated shell program and executes unintended commands in the job.",
                "Assign the expression to an environment variable or pass it as a reviewed action input, then quote the shell variable for the selected shell.",
            )
        )

    destructive_lines: list[int] = []
    for index, line in enumerate(lines):
        destructive = re.search(r"\b(close-pr|lock-pr|auto-close|delete-(?:issue|pr))\s*:\s*(true|yes)\b", line, re.IGNORECASE)
        if destructive:
            destructive_lines.append(index)
            after = replace_line_value(text, index, "false")
            findings.append(
                make_finding(
                    "MD-MOD-001", "high", "high", rel, index + 1, destructive.start(1) + 1,
                    f"Automation enables destructive operation {destructive.group(1)}.",
                    "A false positive, poisoned classifier input, or configuration mistake can close, lock, or delete legitimate contributor work without human review.",
                    "Start in report-only mode, require human review, publish an appeal path, and enable destructive behavior only after measuring false positives.",
                    before=text, after=after, fix_safety="safe",
                )
            )

        proxy = re.search(r"\b(" + "|".join(re.escape(key) for key in IDENTITY_PROXIES) + r")\s*:\s*([^\s#]+)", line)
        if proxy:
            key, raw = proxy.group(1), proxy.group(2).lower()
            enabled = raw in {"true", "yes"} or (raw.isdigit() and int(raw) > 0)
            if enabled:
                disabled = "false" if raw in {"true", "yes"} else "0"
                after = replace_line_value(text, index, disabled)
                findings.append(
                    make_finding(
                        "MD-MOD-002", "medium", "high", rel, index + 1, proxy.start(1) + 1,
                        f"Automated triage uses {IDENTITY_PROXIES[key]} as a contributor-risk proxy.",
                        "A legitimate newcomer can be penalized for identity or history characteristics unrelated to the quality and safety of the submitted change.",
                        "Disable the proxy and evaluate reproducibility, scope, tests, policy compliance, and contributor responsiveness instead.",
                        before=text, after=after, fix_safety="safe",
                    )
                )
    if destructive_lines:
        policy_text = "\n".join(
            path.read_text(encoding="utf-8", errors="replace")
            for path in list(target.glob("*.md")) + list((target / "docs").glob("*.md") if (target / "docs").is_dir() else [])
        ).lower()
        if not any(term in policy_text for term in ("appeal", "reopen", "kháng nghị", "異議")):
            first = destructive_lines[0]
            findings.append(
                make_finding(
                    "MD-MOD-003", "medium", "medium", rel, first + 1, 1,
                    "Destructive moderation is enabled without a discoverable appeal or reopening policy.",
                    "A false positive can become permanent because contributors have no documented path to request human reconsideration.",
                    "Document the appeal channel, review owner, response expectation, and process for reopening false positives before enabling enforcement.",
                )
            )
    return findings


def audit_repository(target: Path) -> dict:
    findings = governance_findings(target)
    records = index_workflows(target)
    for record in records:
        findings.extend(workflow_findings(target, record.path))
    findings.extend(artifact_trust_findings(target, records))
    findings.sort(
        key=lambda item: (
            -SEVERITY_ORDER[item["severity"]],
            item["location"]["path"],
            item["location"]["line"],
            item["rule_id"],
        )
    )
    counts = {severity: 0 for severity in SEVERITY_ORDER}
    for finding in findings:
        counts[finding["severity"]] += 1
    return {
        "schema_version": 1,
        "tool": {"name": "maintainer-defense", "version": AUDITOR_VERSION},
        "target": str(target),
        "summary": {"total": len(findings), "by_severity": counts},
        "findings": findings,
    }


def report_with_findings(report: dict, findings: list[dict]) -> dict:
    counts = {severity: 0 for severity in SEVERITY_ORDER}
    for finding in findings:
        counts[finding["severity"]] += 1
    updated = dict(report)
    updated["findings"] = findings
    updated["summary"] = {"total": len(findings), "by_severity": counts}
    return updated


def load_baseline(path: Path) -> set[str]:
    try:
        data = json.loads(path.expanduser().read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise KitError(f"invalid baseline JSON {path}: {exc}") from exc
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise KitError("baseline must be a schema-v1 maintainer-defense JSON report")
    findings = data.get("findings")
    if not isinstance(findings, list):
        raise KitError("baseline report must contain a findings array")
    fingerprints: set[str] = set()
    for finding in findings:
        fingerprint = finding.get("fingerprint") if isinstance(finding, dict) else None
        if not isinstance(fingerprint, str) or not fingerprint:
            raise KitError("every baseline finding must contain a non-empty fingerprint")
        fingerprints.add(fingerprint)
    return fingerprints


def filter_new(report: dict, baseline_fingerprints: set[str]) -> dict:
    findings = [
        finding for finding in report["findings"]
        if finding["fingerprint"] not in baseline_fingerprints
    ]
    return report_with_findings(report, findings)


def audit_git_ref(target: Path, ref: str) -> dict:
    """Archive and audit one local commit without executing repository code."""
    verify = subprocess.run(
        ["git", "-C", str(target), "rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}"],
        text=True,
        capture_output=True,
        check=False,
    )
    if verify.returncode != 0:
        raise KitError(f"unknown or non-commit Git ref: {ref}")
    commit = verify.stdout.strip()
    archived = subprocess.run(
        ["git", "-C", str(target), "archive", "--format=tar", commit],
        capture_output=True,
        check=False,
    )
    if archived.returncode != 0:
        detail = archived.stderr.decode(errors="replace").strip()
        raise KitError(f"cannot archive Git ref {ref}: {detail}")
    with tempfile.TemporaryDirectory(prefix="maintainer-defense-ref-") as tmp:
        snapshot = Path(tmp)
        with tarfile.open(fileobj=io.BytesIO(archived.stdout), mode="r:") as archive:
            for member in archive.getmembers():
                parts = Path(member.name).parts
                if member.name.startswith("/") or ".." in parts:
                    raise KitError(f"unsafe path in Git archive: {member.name}")
                if not member.isfile():
                    continue
                source = archive.extractfile(member)
                if source is None:
                    continue
                destination = snapshot.joinpath(*parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(source.read())
        return audit_repository(snapshot)


def summary_headline(report: dict) -> str:
    summary = report["summary"]
    return " · ".join(
        [f"{summary['total']} finding{'s' if summary['total'] != 1 else ''}"]
        + [
            f"{count} {severity}"
            for severity, count in summary["by_severity"].items()
            if count
        ]
    )


def render_summary(report: dict) -> str:
    rows = [summary_headline(report)]
    if report["findings"]:
        rows.append("")
    for finding in report["findings"]:
        rows.append(
            f"{finding['severity'].upper():8} {finding['rule_id']}  {finding['message']}"
        )
    return "\n".join(rows) + "\n"


def render_human(report: dict) -> str:
    headline = summary_headline(report)
    if not report["findings"]:
        return headline + "\n"
    rows = [headline, ""]
    for finding in report["findings"]:
        location = finding["location"]
        rows.extend(
            [
                f"{finding['severity'].upper():8} {finding['rule_id']} {location['path']}:{location['line']}:{location['column']}",
                f"  Evidence: {finding['message']}",
                f"  Risk: {finding['threat_scenario']}",
                f"  Safe remediation: {finding['recommendation']}",
                f"  Rule: {rule_help_uri(finding['rule_id'])}",
            ]
        )
        if finding["fix"]["available"]:
            rows.append(f"  Patch: available ({finding['fix']['safety']})")
        rows.append("")
    return "\n".join(rows) + "\n"


def render_sarif(report: dict) -> dict:
    rules: dict[str, dict] = {}
    results = []
    levels = {"critical": "error", "high": "error", "medium": "warning", "low": "note", "note": "note"}
    for finding in report["findings"]:
        rule_id = finding["rule_id"]
        metadata = rule_metadata(rule_id)
        mappings = [f"{item['framework']}:{item['id']}" for item in metadata["mappings"]]
        rules.setdefault(
            rule_id,
            {
                "id": rule_id,
                "name": rule_id.replace("-", "_"),
                "shortDescription": {"text": metadata["title"]},
                "fullDescription": {"text": metadata["description"]},
                "help": {"text": metadata["safe_remediation"]},
                "helpUri": rule_help_uri(rule_id),
                "properties": {
                    "security-severity": str(SEVERITY_ORDER[metadata["default_severity"]] * 2.5),
                    "tags": mappings,
                },
            },
        )
        location = finding["location"]
        result = {
            "ruleId": rule_id,
            "level": levels[finding["severity"]],
            "message": {"text": finding["message"]},
            "partialFingerprints": {"maintainerDefenseFingerprint/v1": finding["fingerprint"]},
        }
        if (Path(report["target"]) / location["path"]).is_file():
            result["locations"] = [
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": location["path"]},
                        "region": {"startLine": location["line"], "startColumn": location["column"]},
                    }
                }
            ]
        results.append(result)
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": report["tool"]["name"],
                        "version": report["tool"]["version"],
                        "informationUri": "https://github.com/thangldw/awesome-maintainer-defense",
                        "rules": list(rules.values()),
                    }
                },
                "results": results,
            }
        ],
    }


def combined_patch(report: dict, safe_only: bool) -> str:
    selected = [
        finding for finding in report["findings"]
        if finding["fix"]["available"]
        and (not safe_only or finding["fix"]["safety"] == "safe")
    ]
    by_path: dict[str, list[dict]] = {}
    for finding in selected:
        by_path.setdefault(finding["location"]["path"], []).append(finding)
    patches: list[str] = []
    target = Path(report["target"])
    for relative, file_findings in sorted(by_path.items()):
        path = target / relative
        before = path.read_text(encoding="utf-8", errors="replace")
        lines = before.splitlines(keepends=True)
        insert_permissions = any(item["rule_id"] == "MD-WF-001" for item in file_findings)
        for finding in sorted(file_findings, key=lambda item: item["location"]["line"], reverse=True):
            index = finding["location"]["line"] - 1
            if finding["rule_id"] == "MD-WF-002":
                ending = "\n" if lines[index].endswith("\n") else ""
                prefix = lines[index].split(":", 1)[0]
                lines[index] = f"{prefix}: {{}}{ending}"
            elif finding["rule_id"] in {"MD-MOD-001", "MD-MOD-002"}:
                ending = "\n" if lines[index].endswith("\n") else ""
                prefix = lines[index].split(":", 1)[0]
                current = lines[index].split(":", 1)[1].strip().split("#", 1)[0].strip().lower()
                disabled = "false" if current in {"true", "yes"} else "0"
                lines[index] = f"{prefix}: {disabled}{ending}"
        after = "".join(lines)
        if insert_permissions:
            first_end = after.find("\n") + 1 if re.match(r"^name\s*:", after) else 0
            after = after[:first_end] + "permissions: {}\n\n" + after[first_end:]
        if before != after:
            patches.append(unified_patch(relative, before, after))
    return "".join(patches)


def parse_install_args(arguments: list[str] | None = None) -> argparse.Namespace:
    parser = UsageArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, type=Path, help="target repository")
    parser.add_argument("--profile", choices=PROFILES, default="observe")
    parser.add_argument("--language", choices=LANGUAGES, default="en")
    parser.add_argument("--repo", help="GitHub OWNER/REPOSITORY (auto-detected when possible)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="write the previewed installation")
    mode.add_argument("--verify", action="store_true", help="verify files against the manifest")
    mode.add_argument("--uninstall", action="store_true", help="remove unmodified installer-owned files")
    return parser.parse_args(arguments)


def parse_audit_args(command: str, arguments: list[str]) -> argparse.Namespace:
    parser = UsageArgumentParser(prog=f"maintainer-defense {command}")
    parser.add_argument("target", nargs="?", default=".", type=Path, help="repository checkout")
    if command == "audit":
        parser.add_argument(
            "--format", choices=("human", "summary", "json", "sarif"), default="human"
        )
        parser.add_argument("--output", type=Path, help="write output to a file")
        parser.add_argument(
            "--fail-on", choices=("critical", "high", "medium", "low", "note"),
            help="exit 2 when a finding at or above this severity is present",
        )
        comparison = parser.add_mutually_exclusive_group()
        comparison.add_argument("--baseline", type=Path, help="schema-v1 JSON report")
        comparison.add_argument("--compare-ref", help="local Git commit to audit as baseline")
        parser.add_argument(
            "--config", type=Path,
            help="suppression config (default: TARGET/.maintainer-defense.json when present)",
        )
        parser.add_argument(
            "--new-only", action="store_true",
            help="emit only fingerprints absent from exactly one comparison source",
        )
    else:
        parser.add_argument("--output", type=Path, help="write unified diff to a file")
        parser.add_argument("--safe-only", action="store_true", help="exclude review-required patches")
        parser.add_argument(
            "--dry-run", action="store_true",
            help="compatibility flag; fix always emits a patch and never edits files",
        )
    args = parser.parse_args(arguments)
    if command == "audit":
        has_comparison = bool(args.baseline or args.compare_ref)
        if args.new_only and not has_comparison:
            parser.error("--new-only requires exactly one of --baseline or --compare-ref")
        if has_comparison and not args.new_only:
            parser.error("--baseline and --compare-ref require --new-only")
    return args


def emit_output(content: str, output: Path | None) -> None:
    if output is None:
        sys.stdout.write(content)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{output.name}.", dir=output.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, output)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    print(f"WROTE {output}", file=sys.stderr)


def run_auditor(command: str, arguments: list[str]) -> None:
    args = parse_audit_args(command, arguments)
    target = args.target.expanduser().resolve()
    if not target.is_dir():
        raise KitError(f"target is not a directory: {target}")
    report = audit_repository(target)
    if command == "fix":
        patch = combined_patch(report, args.safe_only)
        emit_output(patch, args.output)
        return
    config_path = args.config.expanduser() if args.config else target / ".maintainer-defense.json"
    if args.config or config_path.is_file():
        entries = load_suppressions(config_path, date.today())
        report, suppressed, warnings = apply_suppressions(report, entries)
        for warning in warnings:
            print(f"WARNING: {warning}", file=sys.stderr)
        if suppressed:
            noun = "finding" if suppressed == 1 else "findings"
            print(f"Suppressed {suppressed} {noun} via {config_path}", file=sys.stderr)
    if args.new_only:
        if args.baseline:
            fingerprints = load_baseline(args.baseline)
        else:
            baseline_report = audit_git_ref(target, args.compare_ref)
            fingerprints = {item["fingerprint"] for item in baseline_report["findings"]}
        report = filter_new(report, fingerprints)
    if args.format == "human":
        content = render_human(report)
    elif args.format == "summary":
        content = render_summary(report)
    elif args.format == "json":
        content = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    else:
        content = json.dumps(render_sarif(report), ensure_ascii=False, indent=2) + "\n"
    emit_output(content, args.output)
    if args.fail_on:
        threshold = SEVERITY_ORDER[args.fail_on]
        if any(SEVERITY_ORDER[item["severity"]] >= threshold for item in report["findings"]):
            raise SystemExit(2)


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--version":
        print(f"maintainer-defense auditor {AUDITOR_VERSION}; kit {KIT_VERSION}")
        return
    if len(sys.argv) == 1:
        print(
            "usage: maintainer-defense {audit,fix,install} ...\n"
            "       maintainer-defense --target REPOSITORY [legacy installer options]\n\n"
            "commands:\n"
            "  audit    inspect local governance, workflows, and moderation automation\n"
            "  fix      emit a reviewable unified diff; never modify the target\n"
            "  install  preview or install a defense-kit profile\n\n"
            "Run a command with --help for details."
        )
        return
    if len(sys.argv) > 1 and sys.argv[1] in {"audit", "fix"}:
        try:
            run_auditor(sys.argv[1], sys.argv[2:])
        except (KitError, OSError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            raise SystemExit(1) from exc
        return
    install_arguments = sys.argv[2:] if len(sys.argv) > 1 and sys.argv[1] == "install" else None
    args = parse_install_args(install_arguments)
    target = args.target.expanduser().resolve()
    try:
        if not target.is_dir():
            raise KitError(f"target is not a directory: {target}")
        if args.verify:
            verify(target)
            return
        if args.uninstall:
            uninstall(target)
            return
        repository = args.repo or detect_repository(target) or "OWNER/REPOSITORY"
        if not valid_repository(repository):
            raise KitError(f"invalid GitHub repository: {repository}")
        if args.apply and repository == "OWNER/REPOSITORY":
            raise KitError("--repo OWNER/REPOSITORY is required when no GitHub origin is detectable")
        install(target, args.profile, args.language, repository, args.apply)
    except (KitError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
